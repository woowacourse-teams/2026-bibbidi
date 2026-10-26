package com.bibbidi.wedding.chat.adapter.ai.client;

import com.bibbidi.wedding.chat.adapter.ai.routing.ChatModelTier;
import org.springframework.ai.chat.messages.UserMessage;

public record ChatModelRequest(
        Long userId,
        String conversationKey,
        UserMessage userMessage,
        ChatModelTier tier
) {
}
