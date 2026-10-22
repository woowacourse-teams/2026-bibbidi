package com.bibbidi.wedding.chat.adapter.ai;

import com.bibbidi.wedding.chat.adapter.ai.client.SpringAiChatClient;
import com.bibbidi.wedding.chat.adapter.ai.observability.AiChatStreamRecorder;
import com.bibbidi.wedding.chat.service.port.AiConversationPort;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import software.amazon.awssdk.services.bedrockruntime.model.ThrottlingException;

@Component
public class SpringAiConversationAdapter implements AiConversationPort {

    private final SpringAiChatClient chatClient;
    private final AiChatStreamRecorder recorder;

    public SpringAiConversationAdapter(
            SpringAiChatClient chatClient,
            AiChatStreamRecorder recorder
    ) {
        this.chatClient = chatClient;
        this.recorder = recorder;
    }

    @Override
    public Flux<String> stream(Long userId, String conversationKey, String userPrompt) {
        UserMessage userMessage = new UserMessage(userPrompt);

        return recorder.record(
                        userPrompt,
                        chatClient.streamReply(userId, conversationKey, userMessage)
                )
                .onErrorMap(SpringAiConversationAdapter::isThrottled, exception -> new BusinessException(
                        ClientError.AI_CAPACITY_EXCEEDED, "Bedrock 호출 한도 초과", exception))
                .onErrorMap(SpringAiConversationAdapter::isEmptyAdvisorResponse, exception -> new BusinessException(
                        ClientError.INTERNAL_ERROR, "AI 응답 없음", exception))
                .map(AiChatStreamRecorder::textOf)
                .filter(text -> !text.isEmpty());
    }

    private static boolean isThrottled(Throwable exception) {
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause instanceof ThrottlingException) {
                return true;
            }
        }
        return false;
    }

    private static boolean isEmptyAdvisorResponse(Throwable exception) {
        return exception instanceof IllegalArgumentException
                && "conversationId cannot be null".equals(exception.getMessage());
    }

}
