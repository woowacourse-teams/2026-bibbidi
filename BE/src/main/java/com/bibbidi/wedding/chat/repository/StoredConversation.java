package com.bibbidi.wedding.chat.repository;

import com.bibbidi.wedding.chat.domain.ConversationState;
import java.time.Duration;
import java.time.Instant;

record StoredConversation(
        ConversationState state,
        Instant expiresAt
) {

    StoredConversation renewOwnedBy(Long userId, Instant now, Duration idleTimeout) {
        return replaceOwnedBy(userId, state, now, idleTimeout);
    }

    StoredConversation replaceOwnedBy(
            Long userId,
            ConversationState replacement,
            Instant now,
            Duration idleTimeout
    ) {
        if (isExpiredAt(now)) {
            return null;
        }
        if (!isOwnedBy(userId)) {
            return this;
        }
        return new StoredConversation(replacement, now.plus(idleTimeout));
    }

    boolean isOwnedBy(Long userId) {
        return state.isOwnedBy(userId);
    }

    boolean isExpiredAt(Instant now) {
        return !now.isBefore(expiresAt);
    }
}
