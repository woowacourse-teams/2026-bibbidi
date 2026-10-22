package com.bibbidi.wedding.chat.adapter.ai.client;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.ToolContext;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

@Component
public class SpringAiChatClient {

    private static final String TOOL_CONTEXT_USER_ID = "userId";

    private final ChatClient chatClient;

    @Autowired
    public SpringAiChatClient(ChatClient chatClient) {
        this.chatClient = chatClient;
    }

    public Flux<ChatResponse> streamReply(Long userId, String conversationKey, UserMessage userMessage) {
        return chatClient.prompt()
                .messages(userMessage)
                .advisors(advisor -> advisor.param(ChatMemory.CONVERSATION_ID, conversationKey))
                .toolContext(Map.of(TOOL_CONTEXT_USER_ID, userId))
                .stream()
                .chatResponse();
    }

    /**
     * 도구가 조회할 사용자는 모델이 정한 인자가 아니라 요청에 담아 보낸 이 값만 따른다.
     */
    public static Long userIdOf(ToolContext toolContext) {
        if (toolContext.getContext().get(TOOL_CONTEXT_USER_ID) instanceof Long userId) {
            return userId;
        }
        throw new IllegalStateException("도구를 호출한 사용자 정보가 없습니다.");
    }
}
