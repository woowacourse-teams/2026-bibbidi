package com.bibbidi.wedding.chat.adapter.ai;

import com.bibbidi.wedding.chat.service.dto.prompt.BibbidiCustomChatPromptContext;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.chat.messages.Message;

public class BibbidiInMemoryChatMemory implements ChatMemory {

    private final ChatMemory conversationMemory;
    private final Clock clock;
    private final Map<String, BibbidiCustomChatPromptContext> bibbidiCustomChatPromptContexts = new ConcurrentHashMap<>();
    private final Map<String, Instant> lastAccessedAt = new ConcurrentHashMap<>();

    public BibbidiInMemoryChatMemory(ChatMemoryRepository repository, int maxMessages) {
        this(repository, maxMessages, Clock.systemUTC());
    }

    public BibbidiInMemoryChatMemory(ChatMemoryRepository repository, int maxMessages, Clock clock) {
        this.conversationMemory = MessageWindowChatMemory.builder()
                .chatMemoryRepository(repository)
                .maxMessages(maxMessages)
                .build();
        this.clock = clock;
    }

    @Override
    public void add(String conversationId, List<Message> messages) {
        touch(conversationId);
        conversationMemory.add(conversationId, messages);
    }

    @Override
    public List<Message> get(String conversationId) {
        return conversationMemory.get(conversationId);
    }

    @Override
    public void clear(String conversationId) {
        conversationMemory.clear(conversationId);
        bibbidiCustomChatPromptContexts.remove(conversationId);
        lastAccessedAt.remove(conversationId);
    }

    public void remember(String conversationId, BibbidiCustomChatPromptContext context) {
        touch(conversationId);
        bibbidiCustomChatPromptContexts.put(conversationId, context);
    }

    public BibbidiCustomChatPromptContext bibbidiCustomContext(String conversationId) {
        return bibbidiCustomChatPromptContexts.get(conversationId);
    }

    public int conversationCount() {
        return lastAccessedAt.size();
    }

    public int evictIdle(Duration idleTimeout) {
        Instant cutoff = clock.instant().minus(idleTimeout);
        int evicted = 0;
        for (Map.Entry<String, Instant> entry : lastAccessedAt.entrySet()) {
            Instant accessedAt = entry.getValue();
            if (accessedAt.isBefore(cutoff) && lastAccessedAt.remove(entry.getKey(), accessedAt)) {
                clear(entry.getKey());
                evicted++;
            }
        }
        return evicted;
    }

    private void touch(String conversationId) {
        lastAccessedAt.put(conversationId, clock.instant());
    }
}
