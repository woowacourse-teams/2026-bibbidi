package com.bibbidi.wedding.chat.config;

import com.bibbidi.wedding.chat.adapter.ai.BibbidiInMemoryChatMemory;
import com.bibbidi.wedding.chat.service.dto.result.ChatAnswer;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.jspecify.annotations.NonNull;
import org.springframework.ai.bedrock.converse.BedrockChatOptions;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.converter.BeanOutputConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(AiChatProperties.class)
public class AiChatConfig {

    @Bean
    ChatClient aiChatClient(
            ChatClient.Builder chatClientBuilder,
            @Value("${spring.ai.bedrock.converse.chat.model}") String model,
            @Value("classpath:prompts/ai-chat-system.txt") Resource systemPrompt
    ) {
        BedrockChatOptions.Builder options = buildBedrockChatOptions(model);
        return chatClientBuilder.defaultSystem(systemPrompt, StandardCharsets.UTF_8)
                .defaultOptions(options)
                .build();
    }

    private BedrockChatOptions.@NonNull Builder buildBedrockChatOptions(String model) {
        BeanOutputConverter<ChatAnswer> outputConverter = new BeanOutputConverter<>(ChatAnswer.class);
        BedrockChatOptions.Builder options = BedrockChatOptions.builder()
                .outputSchema(outputConverter.getJsonSchema());

        if (model.contains("openai.gpt-")) {
            options.requestParameters(strictJsonFormatRequestParameters());
        }

        return options;
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static Map<String, String> strictJsonFormatRequestParameters() {
        Map<String, Map<String, Boolean>> jsonParamater = Map.of(
                "format",
                Map.of("strict", true)
        );

        Map<String, Object> nestedJsonParameters = Map.of(
                "text", jsonParamater
        );
        return (Map) nestedJsonParameters;
    }

    @Bean
    ChatMemory aiChatMemory(ChatMemoryRepository repository, AiChatProperties properties) {
        return new BibbidiInMemoryChatMemory(repository, properties.memoryMaxMessages());
    }

}
