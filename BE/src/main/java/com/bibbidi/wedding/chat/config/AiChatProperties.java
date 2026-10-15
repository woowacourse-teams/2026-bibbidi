package com.bibbidi.wedding.chat.config;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("bibbidi.ai")
public record AiChatProperties(
        @Positive @NotNull Long responseTimeoutSeconds,
        @Min(4) int memoryMaxMessages
) {
}
