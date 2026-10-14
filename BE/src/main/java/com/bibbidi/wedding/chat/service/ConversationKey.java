package com.bibbidi.wedding.chat.service;

import java.util.UUID;

public record ConversationKey(
        Long userId,
        UUID conversationId
) {

    public static ConversationKey fromMemoryKey(String key) {
        String[] parts = key.split(":", 2);
        return new ConversationKey(Long.valueOf(parts[0]), UUID.fromString(parts[1]));
    }

    public String toMemoryKey() {
        return userId + ":" + conversationId;
    }
}
