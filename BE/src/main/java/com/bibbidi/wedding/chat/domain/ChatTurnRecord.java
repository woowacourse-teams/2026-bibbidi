package com.bibbidi.wedding.chat.domain;

import java.time.LocalDateTime;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

public record ChatTurnRecord(
        Long userId,
        UUID conversationId,
        String userPrompt,
        String completion,
        ChatTurnOutcome outcome,
        @Nullable String outcomeReason,
        LocalDateTime startedAt
) {
}
