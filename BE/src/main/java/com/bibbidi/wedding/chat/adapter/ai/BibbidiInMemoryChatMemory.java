package com.bibbidi.wedding.chat.adapter.ai;

import com.bibbidi.wedding.chat.service.dto.prompt.BibbidiCustomChatPromptContext;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.chat.messages.Message;

public class BibbidiInMemoryChatMemory implements ChatMemory {

    private final ChatMemory conversationMemory;
    private final Map<String, BibbidiCustomChatPromptContext> bibbidiCustomChatPromptContexts = new ConcurrentHashMap<>();

    public BibbidiInMemoryChatMemory(ChatMemoryRepository repository, int maxMessages) {
        this.conversationMemory = MessageWindowChatMemory.builder()
                .chatMemoryRepository(repository)
                .maxMessages(maxMessages)
                .build();
    }

    @Override
    public void add(String conversationId, List<Message> messages) {
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
    }

    public void remember(String conversationId, BibbidiCustomChatPromptContext context) {
        bibbidiCustomChatPromptContexts.put(conversationId, context);
    }

    public BibbidiCustomChatPromptContext bibbidiCustomContext(String conversationId) {
        return bibbidiCustomChatPromptContexts.get(conversationId);
    }
}
