package com.bibbidi.wedding.chat.service;

import com.bibbidi.wedding.chat.service.dto.ChatResult;
import com.bibbidi.wedding.chat.tools.ChatToolContext;
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

@Service
public class AiChatService {

    private final ChatClient chatClient;
    private final ChatMemory chatMemory;
    private final Set<ConversationKey> activeConversations = ConcurrentHashMap.newKeySet();

    public AiChatService(ChatClient chatClient, ChatMemory chatMemory) {
        this.chatClient = chatClient;
        this.chatMemory = chatMemory;
    }

    public void chat(Long userId, @Nullable UUID conversationId, String message, ChatReplyHandler reply) {
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

    private String streamAnswer(ConversationKey key, String message, ChatReplyHandler reply) {
        try (Stream<String> chunks = chatClient.prompt()
                .messages(chatMemory.get(key.toMemoryKey()))
                .messages(new UserMessage(message))
                .toolContext(new ChatToolContext(key.userId()).toMap())
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
                throw new BusinessException(ClientError.INTERNAL_ERROR, "챗봇이 빈 답변을 반환했습니다.");
            }
            return answer;
        }
    }

    private void rememberTurn(ConversationKey key, String message, String answer) {
        List<Message> turnMessages = List.of(new UserMessage(message), new AssistantMessage(answer));
        chatMemory.add(key.toMemoryKey(), turnMessages);
    }
}
