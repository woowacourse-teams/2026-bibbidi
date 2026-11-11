package com.bibbidi.wedding.chat.adapter.ai.observation;

import io.micrometer.common.KeyValue;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tag;
import java.util.ArrayList;
import java.util.List;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.observation.ChatModelMeterObservationHandler;
import org.springframework.ai.chat.observation.ChatModelObservationContext;

/**
 * 기본 토큰 지표(input·output·total)에 프롬프트 캐시 토큰을 더한다.
 * Bedrock은 캐시로 읽거나 쓴 입력을 input에 넣지 않으므로, 비용을 계산하려면 별도 유형이 필요하다.
 */
public class CacheTokenMeterObservationHandler extends ChatModelMeterObservationHandler {

    static final String METRIC_NAME = "gen_ai.client.token.usage";
    static final String TOKEN_TYPE_TAG = "gen_ai.token.type";
    static final String CACHE_READ = "cache_read";
    static final String CACHE_WRITE = "cache_write";

    private final MeterRegistry meterRegistry;

    public CacheTokenMeterObservationHandler(MeterRegistry meterRegistry) {
        super(meterRegistry);
        this.meterRegistry = meterRegistry;
    }

    @Override
    public void onStop(ChatModelObservationContext context) {
        super.onStop(context);
        if (context.getResponse() == null || context.getResponse().getMetadata() == null) {
            return;
        }
        Usage usage = context.getResponse().getMetadata().getUsage();
        if (usage == null) {
            return;
        }
        record(CACHE_READ, usage.getCacheReadInputTokens(), context);
        record(CACHE_WRITE, usage.getCacheWriteInputTokens(), context);
    }

    private void record(String tokenType, Long tokens, ChatModelObservationContext context) {
        if (tokens == null) {
            return;
        }
        Counter.builder(METRIC_NAME)
                .tag(TOKEN_TYPE_TAG, tokenType)
                .description("Measures number of input and output tokens used")
                .tags(tagsOf(context))
                .register(meterRegistry)
                .increment(tokens);
    }

    private static List<Tag> tagsOf(ChatModelObservationContext context) {
        List<Tag> tags = new ArrayList<>();
        for (KeyValue keyValue : context.getLowCardinalityKeyValues()) {
            tags.add(Tag.of(keyValue.getKey(), keyValue.getValue()));
        }
        return tags;
    }
}
