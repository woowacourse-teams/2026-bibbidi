package com.bibbidi.wedding.balancegame.adapter.ai;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.springframework.ai.bedrock.converse.BedrockChatOptions;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.converter.BeanOutputConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(BalanceGameAiProperties.class)
public class BalanceGameAiConfig {

    @Bean
    ChatClient balanceGameChatClient(
            ChatModel chatModel,
            BalanceGameAiProperties properties,
            @Value("classpath:prompts/balance-game-system.txt") Resource prompt
    ) throws IOException {
        String schema = new BeanOutputConverter<>(BalanceGameRecommender.RecommendationOutput.class).getJsonSchema();
        BedrockChatOptions.Builder options = BedrockChatOptions.builder()
                .model(properties.model())
                .outputSchema(schema);
        if (properties.model().contains("openai.gpt-")) {
            options.requestParameters(strictJsonFormatParameters());
        }
        return ChatClient.builder(chatModel)
                .defaultOptions(options)
                .defaultSystem(prompt.getContentAsString(StandardCharsets.UTF_8))
                .build();
    }

    // 기존 Bedrock Sol 설정과 동일하게 중첩된 strict 옵션을 전달한다.
    @SuppressWarnings({"rawtypes", "unchecked"})
    private static Map<String, String> strictJsonFormatParameters() {
        return (Map) Map.of("text", Map.of("format", Map.of("strict", true)));
    }
}
