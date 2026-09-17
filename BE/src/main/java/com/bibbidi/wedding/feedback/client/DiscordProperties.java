package com.bibbidi.wedding.feedback.client;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "discord")
public record DiscordProperties(String feedbackWebHookUrl) {
}
