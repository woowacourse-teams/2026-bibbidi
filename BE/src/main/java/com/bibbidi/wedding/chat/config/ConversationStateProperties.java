package com.bibbidi.wedding.chat.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "bibbidi.chat")
public record ConversationStateProperties(Duration idleTimeout) {

    public ConversationStateProperties {
        if (idleTimeout == null || idleTimeout.isZero() || idleTimeout.isNegative()) {
            throw new IllegalArgumentException("대화 만료 시간은 양수여야 합니다.");
        }
    }
}
