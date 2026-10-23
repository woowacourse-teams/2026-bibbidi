package com.bibbidi.wedding.chat.adapter.ai;

import com.bibbidi.wedding.chat.adapter.ai.client.SpringAiChatClient;
import com.bibbidi.wedding.chat.adapter.ai.parser.JacksonChatAnswerParser;
import com.bibbidi.wedding.chat.adapter.ai.parser.ReactiveChatAnswerStream;
import com.bibbidi.wedding.chat.service.port.AiConversationPort;
import com.bibbidi.wedding.chat.service.port.AiResponse;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.util.ArrayList;
import java.util.List;
import reactor.core.publisher.Flux;
import reactor.core.scheduler.Schedulers;
import software.amazon.awssdk.services.bedrockruntime.model.ThrottlingException;

@Component
public class SpringAiConversationAdapter implements AiConversationPort {

    private final SpringAiChatClient chatClient;
    private final JacksonChatAnswerParser answerParser;

    private final String modelName;

    public SpringAiConversationAdapter(
            SpringAiChatClient chatClient,
            JacksonChatAnswerParser answerParser,
            @Value("${spring.ai.bedrock.converse.chat.model}") String modelName
    ) {
        this.chatClient = chatClient;
        this.answerParser = answerParser;
        this.modelName = modelName;
    }

    @Override
    public String modelName() {
        return modelName;
    }

    @Override
    public Flux<AiResponse> stream(Long userId, String conversationKey, String userPrompt) {
        UserMessage userMessage = new UserMessage(userPrompt);

        return Flux.defer(() -> {
            List<String> deltas = new ArrayList<>();
            ReactiveChatAnswerStream answer = answerParser.newSession(deltas::add);
            Flux<AiResponse> chunks = chatClient.streamReply(userId, conversationKey, userMessage)
                .onErrorMap(SpringAiConversationAdapter::isThrottled, exception -> new BusinessException(
                        ClientError.AI_CAPACITY_EXCEEDED, "Bedrock 호출 한도 초과", exception))
                .onErrorMap(SpringAiConversationAdapter::isEmptyAdvisorResponse, exception -> new BusinessException(
                        ClientError.INTERNAL_ERROR, "AI 응답 없음", exception))
                .map(SpringAiConversationAdapter::textOf)
                .filter(text -> !text.isEmpty())
                .publishOn(Schedulers.boundedElastic())
                .map(raw -> {
                    deltas.clear();
                    answer.accept(raw);
                    return new AiResponse.Chunk(raw, List.copyOf(deltas));
                });
            return chunks.concatWith(Flux.defer(() -> Flux.just(new AiResponse.Answer(answer.finish()))));
        });
    }

    private static String textOf(ChatResponse response) {
        if (response.getResult() == null
                || response.getResult().getOutput() == null
                || response.getResult().getOutput().getText() == null) {
            return "";
        }
        return response.getResult().getOutput().getText();
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
