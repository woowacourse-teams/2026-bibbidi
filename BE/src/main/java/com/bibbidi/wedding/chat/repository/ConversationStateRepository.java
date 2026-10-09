package com.bibbidi.wedding.chat.repository;

import com.bibbidi.wedding.chat.config.ConversationStateProperties;
import com.bibbidi.wedding.chat.domain.ConversationState;
import com.bibbidi.wedding.chat.domain.PreparationSnapshot;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Repository;

@Repository
public class ConversationStateRepository {

    private final Map<String, StoredConversation> conversations = new ConcurrentHashMap<>();
    private final Clock clock;
    private final Duration idleTimeout;

    public ConversationStateRepository(
            @Qualifier("conversationClock") Clock clock,
            ConversationStateProperties properties
    ) {
        this.clock = clock;
        this.idleTimeout = properties.idleTimeout();
    }

    public ConversationState create(Long ownerId, PreparationSnapshot snapshot) {
        ConversationState state = new ConversationState(UUID.randomUUID().toString(), ownerId, snapshot,
                List.of(), Set.of());
        conversations.put(state.id(), new StoredConversation(state, clock.instant().plus(idleTimeout)));
        return state;
    }

    public Optional<ConversationState> findOwnedBy(String conversationId, Long userId) {
        Instant now = clock.instant();
        StoredConversation stored = conversations.computeIfPresent(conversationId, (id, existing) -> {
            if (existing.isExpiredAt(now)) {
                return null;
            }
            if (!existing.state().isOwnedBy(userId)) {
                return existing;
            }
            return new StoredConversation(existing.state(), now.plus(idleTimeout));
        });
        return Optional.ofNullable(stored).map(StoredConversation::state).filter(state -> state.isOwnedBy(userId));
    }

    public Optional<ConversationState> saveOwnedBy(Long userId, ConversationState state) {
        if (!state.isOwnedBy(userId)) {
            return Optional.empty();
        }
        Instant now = clock.instant();
        StoredConversation stored = conversations.computeIfPresent(state.id(), (id, existing) -> {
            if (existing.isExpiredAt(now)) {
                return null;
            }
            if (!existing.state().isOwnedBy(userId)) {
                return existing;
            }
            return new StoredConversation(state, now.plus(idleTimeout));
        });
        return Optional.ofNullable(stored).map(StoredConversation::state).filter(saved -> saved.isOwnedBy(userId));
    }

    public boolean deleteOwnedBy(String conversationId, Long userId) {
        StoredConversation stored = conversations.get(conversationId);
        return stored != null && stored.state().isOwnedBy(userId) && conversations.remove(conversationId, stored);
    }

    @Scheduled(cron = "${bibbidi.chat.cleanup-cron}")
    public int cleanupExpired() {
        Instant now = clock.instant();
        int removed = 0;
        for (Map.Entry<String, StoredConversation> entry : conversations.entrySet()) {
            if (entry.getValue().isExpiredAt(now) && conversations.remove(entry.getKey(), entry.getValue())) {
                removed++;
            }
        }
        return removed;
    }

    private record StoredConversation(ConversationState state, Instant expiresAt) {

        private boolean isExpiredAt(Instant now) {
            return !now.isBefore(expiresAt);
        }
    }
}
