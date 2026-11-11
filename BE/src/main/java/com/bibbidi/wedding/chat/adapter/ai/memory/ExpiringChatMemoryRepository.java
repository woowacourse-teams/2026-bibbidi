package com.bibbidi.wedding.chat.adapter.ai.memory;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Scheduler;
import com.github.benmanes.caffeine.cache.Ticker;
import java.time.Duration;
import java.util.List;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.messages.Message;

public class ExpiringChatMemoryRepository implements ChatMemoryRepository {

    private final Cache<String, List<Message>> conversations;

    public ExpiringChatMemoryRepository(Duration idleTimeout) {
        this(idleTimeout, Ticker.systemTicker(), Scheduler.systemScheduler());
    }

    public ExpiringChatMemoryRepository(Duration idleTimeout, Ticker ticker, Scheduler scheduler) {
        this.conversations = Caffeine.newBuilder()
                .expireAfterAccess(idleTimeout)
                .ticker(ticker)
                .scheduler(scheduler)
                .build();
    }

    @Override
    public List<String> findConversationIds() {
        return List.copyOf(conversations.asMap().keySet());
    }

    @Override
    public List<Message> findByConversationId(String conversationId) {
        List<Message> messages = conversations.getIfPresent(conversationId);
        return messages == null ? List.of() : messages;
    }

    @Override
    public void saveAll(String conversationId, List<Message> messages) {
        conversations.put(conversationId, List.copyOf(messages));
    }

    @Override
    public void deleteByConversationId(String conversationId) {
        conversations.invalidate(conversationId);
    }
}
