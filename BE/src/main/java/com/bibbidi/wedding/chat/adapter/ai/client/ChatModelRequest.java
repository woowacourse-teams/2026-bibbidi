package com.bibbidi.wedding.chat.adapter.ai.client;

import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.ai.chat.messages.UserMessage;

public record ChatModelRequest(
        Long userId,
        String conversationKey,
        UserMessage userMessage,
        AtomicBoolean writeAttempted,
        AtomicBoolean writeSucceeded
) {
    public ChatModelRequest(Long userId, String conversationKey, UserMessage userMessage) {
        this(userId, conversationKey, userMessage, new AtomicBoolean(), new AtomicBoolean());
    }
}
