package com.bibbidi.wedding.balancegame.adapter.ai.config;

import com.bibbidi.wedding.balancegame.adapter.ai.client.BalanceGameModelTarget;
import com.bibbidi.wedding.balancegame.adapter.ai.prompt.BalanceGameSystemPrompt;
import java.util.Map;
import org.springframework.ai.bedrock.converse.BedrockChatOptions;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class BalanceGameAiConfig {

    private static final String OPENAI_MODEL_MARKER = "openai.gpt-";

    @Bean
    BalanceGameModelTarget balanceGameModelTarget(
            ChatClient.Builder chatClientBuilder,
            @Value("${spring.ai.bedrock.converse.chat.model}") String model,
            BalanceGameSystemPrompt systemPrompt
    ) {
        ChatClient client = chatClientBuilder.defaultSystem(systemPrompt.text()).build();
        return new BalanceGameModelTarget(client, schema -> {
            BedrockChatOptions.Builder options = BedrockChatOptions.builder()
                    .model(model)
                    .outputSchema(schema);
            if (model.contains(OPENAI_MODEL_MARKER)) {
                options.requestParameters(strictJsonFormatParameters());
            }
            return options;
        });
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static Map<String, String> strictJsonFormatParameters() {
        Map<String, Object> parameters = Map.of(
                "text", Map.of(
                        "format", Map.of("strict", true)
                )
        );
        return (Map) parameters;
    }
}
