package com.bibbidi.wedding.chat.config;

import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("bibbidi.ai.chatbot")
public record AiChatProperties(
        @Min(4) int memoryMaxMessages
) {
}
