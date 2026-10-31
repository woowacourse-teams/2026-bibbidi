package com.bibbidi.wedding.chat.adapter.ai.observation;

import static org.assertj.core.api.Assertions.assertThat;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.DefaultUsage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.observation.ChatModelObservationContext;
import org.springframework.ai.chat.prompt.Prompt;

class CacheTokenMeterObservationHandlerTest {

    private final SimpleMeterRegistry registry = new SimpleMeterRegistry();
    private final CacheTokenMeterObservationHandler handler = new CacheTokenMeterObservationHandler(registry);

    private static ChatModelObservationContext context(DefaultUsage usage) {
        ChatModelObservationContext context = ChatModelObservationContext.builder()
                .prompt(new Prompt("질문"))
                .provider("bedrock_converse")
                .build();
        context.setResponse(new ChatResponse(
                List.of(new Generation(new AssistantMessage("답"))),
                ChatResponseMetadata.builder().usage(usage).build()));
        return context;
    }

    private double count(String tokenType) {
        return registry.find("gen_ai.client.token.usage").tag("gen_ai.token.type", tokenType)
                .counter().count();
    }

    @Test
    @DisplayName("캐시 읽기·쓰기 토큰을 기본 토큰 지표와 함께 별도 유형으로 기록한다")
    void recordsCacheTokensAlongsideDefaultTokens() {
        handler.onStop(context(new DefaultUsage(2, 40, 10_000, null, 9_900L, 58L)));

        assertThat(count("input")).isEqualTo(2d);
        assertThat(count("output")).isEqualTo(40d);
        assertThat(count("cache_read")).isEqualTo(9_900d);
        assertThat(count("cache_write")).isEqualTo(58d);
    }

    @Test
    @DisplayName("캐시 토큰이 응답에 없으면 캐시 지표를 만들지 않는다")
    void skipsCacheMetricsWithoutCacheTokens() {
        handler.onStop(context(new DefaultUsage(120, 30, 150, null)));

        assertThat(count("input")).isEqualTo(120d);
        assertThat(registry.find("gen_ai.client.token.usage").tag("gen_ai.token.type", "cache_read").counter())
                .isNull();
    }
}
