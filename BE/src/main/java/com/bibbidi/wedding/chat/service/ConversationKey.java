package com.bibbidi.wedding.chat.service;

import java.util.UUID;

public record ConversationKey(
        Long userId,
        UUID conversationId
) {

    private static final String SEPARATOR = ":";

    public static ConversationKey fromMemoryKey(String memoryKey) {
        int separatorIndex = memoryKey.indexOf(SEPARATOR);
        return new ConversationKey(
                Long.valueOf(memoryKey.substring(0, separatorIndex)),
                UUID.fromString(memoryKey.substring(separatorIndex + 1))
        );
    }

    public String toMemoryKey() {
        return userId + SEPARATOR + conversationId;
    }
}
