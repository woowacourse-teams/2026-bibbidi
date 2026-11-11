package com.bibbidi.wedding.chat.adapter.ai.config;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("bibbidi.ai.chatbot")
public record AiChatProperties(
        @Min(10) int memoryMaxMessages,
        @NotNull Duration conversationIdleTimeout,
        @NotBlank String qwenModel,
        @NotBlank String solModel,
        @NotBlank String lunaModel
) {
}
