package com.bibbidi.wedding.chat.service.dto.command;

import java.util.UUID;
import org.jspecify.annotations.Nullable;

public record ChatCommand(
        Long userId,
        @Nullable UUID conversationId,
        String message
) {
}
