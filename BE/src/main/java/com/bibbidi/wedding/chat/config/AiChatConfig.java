package com.bibbidi.wedding.chat.config;

import static org.springframework.ai.chat.client.ChatClient.Builder;

import com.bibbidi.wedding.chat.service.dto.ChatAnswer;
import com.bibbidi.wedding.chat.adapter.ai.BibbidiInMemoryChatMemory;
import java.nio.charset.StandardCharsets;
import java.util.Map;
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
            Builder builder,
            @Value("${spring.ai.bedrock.converse.chat.model}") String model,
            @Value("classpath:prompts/ai-chat-system.txt") Resource systemPrompt
    ) {
        BeanOutputConverter<ChatAnswer> outputConverter = new BeanOutputConverter<>(ChatAnswer.class);
        BedrockChatOptions.Builder options = BedrockChatOptions.builder().outputSchema(outputConverter.getJsonSchema());
        if (model.contains("openai.gpt-")) {
            options.requestParameters(strictJsonFormatRequestParameters());
        }
        return builder.defaultSystem(systemPrompt, StandardCharsets.UTF_8)
                .defaultOptions(options)
                .build();
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static Map<String, String> strictJsonFormatRequestParameters() {
        Map<String, Object> nestedJsonParameters = Map.of("text", Map.of("format", Map.of("strict", true)));
        return (Map) nestedJsonParameters;
    }

    @Bean
    ChatMemory aiChatMemory(ChatMemoryRepository repository, AiChatProperties properties) {
        return new BibbidiInMemoryChatMemory(repository, properties.memoryMaxMessages());
    }

}
