package com.bibbidi.wedding.chat.service.turn;

import java.time.LocalDateTime;
import java.util.UUID;

public record TurnContext(
        Long userId,
        UUID conversationId,
        String userPrompt,
        LocalDateTime startedAt
) {
}
