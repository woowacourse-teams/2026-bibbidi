package com.bibbidi.wedding.chat.adapter.ai.client;

import org.springframework.ai.chat.messages.UserMessage;

public record ChatModelRequest(
        Long userId,
        String conversationKey,
        UserMessage userMessage
) {
}
