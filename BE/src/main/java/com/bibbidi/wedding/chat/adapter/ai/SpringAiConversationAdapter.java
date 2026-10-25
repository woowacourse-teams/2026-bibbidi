package com.bibbidi.wedding.chat.adapter.ai;

import com.bibbidi.wedding.chat.adapter.ai.client.ChatModelRequest;
import com.bibbidi.wedding.chat.adapter.ai.client.SpringAiChatClient;
import com.bibbidi.wedding.chat.adapter.ai.parser.JacksonChatAnswerParser;
import com.bibbidi.wedding.chat.adapter.ai.parser.ReactiveChatAnswerStream;
import com.bibbidi.wedding.chat.adapter.ai.routing.ChatModelTier;
import com.bibbidi.wedding.chat.adapter.ai.routing.ModelClassifier;
import com.bibbidi.wedding.chat.service.port.AiConversationPort;
import com.bibbidi.wedding.chat.service.dto.result.ChatResult;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.Objects;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;
import software.amazon.awssdk.services.bedrockruntime.model.ThrottlingException;

@Component
public class SpringAiConversationAdapter implements AiConversationPort {

    private final SpringAiChatClient chatClient;
    private final JacksonChatAnswerParser answerParser;

    private final ModelClassifier classifier;
    private final String forcedTier;

    @Autowired
    public SpringAiConversationAdapter(
            SpringAiChatClient chatClient,
            JacksonChatAnswerParser answerParser,
            ModelClassifier classifier,
            @Value("${bibbidi.ai.chatbot.routing.forced-tier:}") String forcedTier
    ) {
        this.chatClient = Objects.requireNonNull(chatClient, "chatClient");
        this.answerParser = Objects.requireNonNull(answerParser, "answerParser");
        this.classifier = Objects.requireNonNull(classifier, "classifier");
        this.forcedTier = Objects.requireNonNull(forcedTier, "forcedTier");
    }

    @Override
    public Flux<ChatResult> stream(Long userId, String conversationKey, String userPrompt) {
        return Flux.defer(() -> {
            UserMessage userMessage = new UserMessage(userPrompt);
            Mono<ChatModelTier> selection = forcedTier.isBlank()
                    ? classifier.classify(conversationKey, userPrompt)
                    : Mono.just(ChatModelTier.valueOf(forcedTier.toUpperCase()));
            return selection.flatMapMany(tier -> Flux.concat(
                    Flux.just(new ChatResult.Selected(chatClient.modelName(tier))),
                    streamAnswer(new ChatModelRequest(userId, conversationKey, userMessage, tier))
            ));
        });
    }

    private Flux<ChatResult> streamAnswer(ChatModelRequest request) {
        return Flux.defer(() -> {
            ReactiveChatAnswerStream answer = answerParser.newSession();
            Flux<ChatResult> deltas = chatClient.streamReply(request)
                    .onErrorMap(
                            SpringAiConversationAdapter::isThrottled,
                            exception -> new BusinessException(
                                    ClientError.AI_CAPACITY_EXCEEDED, "Bedrock 호출 한도 초과",
                                    exception
                            )
                    )
                    .onErrorMap(
                            SpringAiConversationAdapter::isEmptyAdvisorResponse,
                            exception -> new BusinessException(
                                    ClientError.INTERNAL_ERROR, "AI 응답 없음",
                                    exception
                            )
                    )
                    .map(SpringAiConversationAdapter::textOf)
                    .filter(text -> !text.isEmpty())
                    .publishOn(Schedulers.boundedElastic())
                    .map(answer::accept)
                    .filter(delta -> !delta.isEmpty())
                    .map(ChatResult.Delta::new);
            return deltas.concatWith(Flux.defer(() -> Flux.just(answer.finish())));
        });
    }

    private static String textOf(ChatResponse response) {
        if (response.getResult() == null || response.getResult().getOutput().getText() == null) {
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
