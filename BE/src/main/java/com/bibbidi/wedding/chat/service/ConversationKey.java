package com.bibbidi.wedding.chat.service;

import java.util.UUID;

public record ConversationKey(
        Long userId,
        UUID conversationId
) {

    public String toMemoryKey() {
        return userId + ":" + conversationId;
    }
}
