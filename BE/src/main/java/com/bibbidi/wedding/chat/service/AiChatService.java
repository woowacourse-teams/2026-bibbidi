package com.bibbidi.wedding.chat.service;

import com.bibbidi.wedding.chat.service.dto.ChatResult;
import com.bibbidi.wedding.chat.service.tools.ChecklistTools;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.jspecify.annotations.Nullable;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.stereotype.Service;

@Service
public class AiChatService {

    private final ChatClient chatClient;
    private final ChatMemory chatMemory;
    private final Set<String> activeConversations = ConcurrentHashMap.newKeySet();

    public AiChatService(ChatClient chatClient, ChatMemory chatMemory) {
        this.chatClient = chatClient;
        this.chatMemory = chatMemory;
    }

    public void chat(Long userId, @Nullable String conversationId, String message, ChatReplyHandler reply) {
        String id = conversationId == null ? UUID.randomUUID().toString() : UUID.fromString(conversationId).toString();
        String memoryKey = userId + ":" + id;
        reply.conversation(id);
        if (!activeConversations.add(memoryKey)) {
            throw new IllegalStateException("같은 대화의 응답이 이미 진행 중입니다.");
        }

        // 답변 조각을 기다리는 작업은 SseService의 가상 스레드에서 실행한다.
        try (var chunks = chatClient.prompt()
                .messages(chatMemory.get(memoryKey))
                .messages(new UserMessage(message))
                .toolContext(Map.of(ChecklistTools.USER_ID, userId))
                .stream().content().toStream()) {
            var answer = new StringBuilder();
            var iterator = chunks.iterator();
            while (iterator.hasNext()) {
                String chunk = iterator.next();
                reply.delta(chunk);
                answer.append(chunk);
            }
            if (answer.toString().isBlank()) {
                throw new IllegalStateException("챗봇이 빈 답변을 반환했습니다.");
            }
            var result = new ChatResult(id, answer.toString());
            reply.complete(result, () -> chatMemory.add(memoryKey,
                    List.of(new UserMessage(message), new AssistantMessage(result.answer()))));
        } finally {
            activeConversations.remove(memoryKey);
        }
    }
}
