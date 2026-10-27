package com.bibbidi.wedding.chat.adapter.ai.client;

import com.bibbidi.wedding.chat.adapter.ai.routing.ChatModelTier;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.Map;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

@Component
public final class SpringAiChatClient {

    private static final String TOOL_CONTEXT_USER_ID = "userId";

    private final ChatModelRouter router;

    public SpringAiChatClient(ChatModelRouter router) {
        this.router = router;
    }

    public Flux<ChatResponse> streamReply(ChatModelRequest request, ChatModelTier tier) {
        ChatModelTarget target = router.route(tier);
        ChatClient.ChatClientRequestSpec prompt = target.client().prompt();
        if (target.options() != null) {
            prompt = prompt.options(target.options().get());
        }
        return prompt
                .messages(request.userMessage())
                .advisors(advisor -> advisor.param(ChatMemory.CONVERSATION_ID, request.conversationKey()))
                .toolContext(Map.of(TOOL_CONTEXT_USER_ID, request.userId()))
                .stream()
                .chatResponse();
    }

    public String modelName(ChatModelTier tier) {
        return router.route(tier).modelName();
    }

    /**
     * 도구는 모델이 정한 인자보다 요청에 담아 보낸 사용자 ID를 따른다.
     */
    public static Long userIdOf(ToolContext toolContext) {
        if (toolContext.getContext().get(TOOL_CONTEXT_USER_ID) instanceof Long userId) {
            return userId;
        }
        throw new BusinessException(ClientError.INTERNAL_ERROR, "도구를 호출한 사용자 정보가 없습니다.");
    }
}
