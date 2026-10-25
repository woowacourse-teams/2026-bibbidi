package com.bibbidi.wedding.chat.adapter.ai.routing;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("bibbidi.ai.chatbot.routing")
public record ModelRoutingProperties(
        String apiKey,
        String endpoint,
        String model,
        Duration timeout,
        double minConfidence,
        int historyMessages
) {
}
