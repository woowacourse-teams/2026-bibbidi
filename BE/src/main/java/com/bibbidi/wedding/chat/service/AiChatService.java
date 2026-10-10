package com.bibbidi.wedding.chat.service;

import com.bibbidi.wedding.chat.service.dto.ChatResult;
import com.bibbidi.wedding.chat.tools.ChatToolContext;
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

@Service
public class AiChatService {

    private final ChatClient chatClient;
    private final ChatMemory chatMemory;
    private final Set<String> activeConversations = ConcurrentHashMap.newKeySet();

    public AiChatService(ChatClient chatClient, ChatMemory chatMemory) {
        this.chatClient = chatClient;
        this.chatMemory = chatMemory;
    }

    public void chat(Long userId, @Nullable UUID conversationId, String message, ChatReplyHandler reply) {
        String id = conversationId == null ? UUID.randomUUID().toString() : conversationId.toString();
        String memoryKey = userId + ":" + id;
        reply.conversation(id);
        if (!activeConversations.add(memoryKey)) {
            throw new IllegalStateException("같은 대화의 응답이 이미 진행 중입니다.");
        }

        try {
            String answer = streamAnswer(userId, memoryKey, message, reply);
            ChatResult result = new ChatResult(id, answer);
            reply.complete(result, () -> rememberTurn(memoryKey, message, answer));
        } finally {
            activeConversations.remove(memoryKey);
        }
    }

    private String streamAnswer(Long userId, String memoryKey, String message, ChatReplyHandler reply) {
        try (Stream<String> chunks = chatClient.prompt()
                .messages(chatMemory.get(memoryKey))
                .messages(new UserMessage(message))
                .toolContext(new ChatToolContext(userId).toMap())
                .stream().content().toStream()) {
            StringBuilder answerBuilder = new StringBuilder();
            Iterator<String> chunksIterator = chunks.iterator();
            while (chunksIterator.hasNext()) {
                String chunk = chunksIterator.next();
                reply.sendAnswerChunk(chunk);
                answerBuilder.append(chunk);
            }

            String answer = answerBuilder.toString();
            if (answer.isBlank()) {
                throw new IllegalStateException("챗봇이 빈 답변을 반환했습니다.");
            }
            return answer;
        }
    }

    private void rememberTurn(String memoryKey, String message, String answer) {
        List<Message> turnMessages = List.of(new UserMessage(message), new AssistantMessage(answer));
        chatMemory.add(memoryKey, turnMessages);
    }
}
