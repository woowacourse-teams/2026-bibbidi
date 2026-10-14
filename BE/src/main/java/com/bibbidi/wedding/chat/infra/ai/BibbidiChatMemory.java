package com.bibbidi.wedding.chat.infra.ai;

import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.chat.service.ConversationKey;
import com.bibbidi.wedding.chat.service.dto.ChecklistSnapshot;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import tools.jackson.databind.ObjectMapper;

public class BibbidiChatMemory implements ChatMemory {

    private static final int FIXED_MESSAGE_COUNT = 2;
    private final ChatMemory conversationMemory;
    private final ChatMemoryRepository repository;
    private final CatalogService catalogService;
    private final ChecklistService checklistService;
    private final ObjectMapper objectMapper;

    public BibbidiChatMemory(ChatMemoryRepository repository, int maxMessages, CatalogService catalogService,
                            ChecklistService checklistService, ObjectMapper objectMapper) {
        this.conversationMemory = MessageWindowChatMemory.builder()
                .chatMemoryRepository(repository).maxMessages(maxMessages - FIXED_MESSAGE_COUNT).build();
        this.repository = repository;
        this.catalogService = catalogService;
        this.checklistService = checklistService;
        this.objectMapper = objectMapper;
    }

    @Override
    public void add(String conversationId, List<Message> messages) {
        conversationMemory.add(conversationId, messages);
    }

    @Override
    public List<Message> get(String conversationId) {
        Long userId = ConversationKey.fromMemoryKey(conversationId).userId();
        List<Message> fixed = refreshFixedMessages(userId);
        return Stream.concat(conversationMemory.get(conversationId).stream(), fixed.stream()).toList();
    }

    @Override
    public void clear(String conversationId) {
        conversationMemory.clear(conversationId);
    }

    private List<Message> refreshFixedMessages(Long userId) {
        List<CatalogItemDetailSnapshot> catalog = List.copyOf(catalogService.findAllItemDetails());
        ChecklistSnapshot checklist = checklistService.findMyChecklistIfPresent(userId)
                .map(ChecklistSnapshot::from).orElseGet(ChecklistSnapshot::notFound);
        Set<Long> addedIds = checklist.items().stream().map(item -> item.catalogItemId()).collect(Collectors.toSet());
        List<Long> recommendableIds = catalog.stream().map(CatalogItemDetailSnapshot::id)
                .filter(id -> !addedIds.contains(id)).toList();
        List<Message> messages = List.of(
                message(Map.of("checklist", checklist, "recommendableItemIds", recommendableIds),
                        Map.of("recommendableItemIds", Set.copyOf(recommendableIds))),
                message(Map.of("catalog", catalog), Map.of()));
        repository.saveAll(userInfoKey(userId), messages);
        return messages;
    }

    private Message message(Map<String, ?> data, Map<String, Object> metadata) {
        return UserMessage.builder().text(objectMapper.writeValueAsString(data)).metadata(metadata).build();
    }

    private static String userInfoKey(Long userId) {
        return "user-info:" + userId;
    }
}
