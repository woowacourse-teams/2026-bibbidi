package com.bibbidi.wedding.chat.service;

import com.bibbidi.wedding.chat.infra.ai.ChatAnswerStream;
import com.bibbidi.wedding.chat.service.dto.ChatAnswer;
import com.bibbidi.wedding.chat.service.dto.ChatResult;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Stream;
import org.jspecify.annotations.Nullable;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import tools.jackson.databind.ObjectMapper;

@Service
public class AiChatService {

    private final ChatClient chatClient;
    private final ChatMemory chatMemory;
    private final ChecklistService checklistService;
    private final ObjectMapper objectMapper;
    private final Set<ConversationKey> activeConversations = ConcurrentHashMap.newKeySet();

    public AiChatService(
            ChatClient chatClient,
            ChatMemory chatMemory,
            ChecklistService checklistService,
            ObjectMapper objectMapper
    ) {
        this.chatClient = chatClient;
        this.chatMemory = chatMemory;
        this.checklistService = checklistService;
        this.objectMapper = objectMapper;
    }

    public void chat(Long userId, @Nullable UUID conversationId, String message, ChatSseHandler reply) {
        UUID id = conversationId == null ? UUID.randomUUID() : conversationId;
        ConversationKey key = new ConversationKey(userId, id);
        reply.conversation(id.toString());
        if (!activeConversations.add(key)) {
            throw new BusinessException(ClientError.INTERNAL_ERROR, "같은 대화의 응답이 이미 진행 중입니다.");
        }

        try {
            String answer = streamAnswer(key, message, reply);
            ChatResult result = new ChatResult(id.toString(), answer);
            reply.complete(result, () -> rememberTurn(key, message, answer));
        } finally {
            activeConversations.remove(key);
        }
    }

    private String streamAnswer(ConversationKey key, String message, ChatSseHandler reply) {
        List<Message> memory = chatMemory.get(key.toMemoryKey());
        Set<?> recommendableIds = findRecommendableIds(memory);
        Flux<String> answerChunks = chatClient.prompt()
                .messages(memory)
                .messages(new UserMessage(message))
                .stream()
                .content();

        try (Stream<String> chunks = answerChunks.toStream()) {
            ChatAnswerStream output = new ChatAnswerStream(objectMapper);
            Iterator<String> chunksIterator = chunks.iterator();
            while (chunksIterator.hasNext()) {
                String delta = output.append(chunksIterator.next());
                if (!delta.isEmpty()) {
                    reply.sendAnswerChunk(delta);
                }
            }
            ChatAnswer answer = output.finish();
            List<Long> suggestedIds = answer.recommendedItemIds().stream()
                    .filter(recommendableIds::contains)
                    .distinct()
                    .toList();
            if (!suggestedIds.isEmpty()) {
                List<Long> ids = checklistService.filterRecommendableCatalogItemIds(key.userId(), suggestedIds);
                if (!ids.isEmpty()) {
                    reply.sendComponent(ids);
                }
            }
            return answer.answer();
        }
    }

    private Set<?> findRecommendableIds(List<Message> messages) {
        for (Message message : messages) {
            if (message.getMetadata().get("recommendableItemIds") instanceof Set<?> ids) {
                return ids;
            }
        }
        return Set.of();
    }

    private void rememberTurn(ConversationKey key, String message, String answer) {
        List<Message> turnMessages = List.of(new UserMessage(message), new AssistantMessage(answer));
        chatMemory.add(key.toMemoryKey(), turnMessages);
    }
}
