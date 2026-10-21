package com.bibbidi.wedding.chat.adapter.ai.config;

import com.bibbidi.wedding.chat.adapter.ai.prompt.SystemPrompt;
import com.bibbidi.wedding.chat.service.dto.result.ChatAnswer;
import java.util.Map;
import org.springframework.ai.bedrock.converse.BedrockChatOptions;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.converter.BeanOutputConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class AiChatConfig {

    @Bean
    ChatClient aiChatClient(
            ChatClient.Builder chatClientBuilder,
            ChatMemory chatMemory,
            ChatOptions.Builder<?> structuredAnswerOptions,
            SystemPrompt systemPrompt
    ) {
        return chatClientBuilder.defaultOptions(structuredAnswerOptions)
                .defaultSystem(systemPrompt.text())
                .defaultAdvisors(MessageChatMemoryAdvisor.builder(chatMemory).build())
                .build();
    }

    @Bean
    ChatOptions.Builder<?> structuredAnswerOptions(
            @Value("${spring.ai.bedrock.converse.chat.model}") String model
    ) {
        BeanOutputConverter<ChatAnswer> outputConverter = new BeanOutputConverter<>(ChatAnswer.class);
        BedrockChatOptions.Builder options = BedrockChatOptions.builder()
                .outputSchema(outputConverter.getJsonSchema());

        if (model.contains("openai.gpt-")) {
            options.requestParameters(strictJsonFormatParameters());
        }

        return options;
    }

    // requestParameters의 타입은 Map<String, String>이라 중첩된 값을 바로 넣을 수 없다.
    // 실제로는 값을 JSON으로 바꿔 보내므로, 타입 검사만 피해서 중첩된 맵을 넘긴다.
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
