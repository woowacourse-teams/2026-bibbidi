package com.bibbidi.wedding.chat.controller.sse.config;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("bibbidi.sse")
public record SseProperties(
        @Positive @NotNull Long responseTimeoutSeconds
) {
}
