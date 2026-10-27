package com.bibbidi.wedding.chat.adapter.ai;

import com.bibbidi.wedding.chat.adapter.ai.client.ChatModelRequest;
import com.bibbidi.wedding.chat.adapter.ai.client.SpringAiChatClient;
import com.bibbidi.wedding.chat.adapter.ai.parser.JacksonChatAnswerParser;
import com.bibbidi.wedding.chat.adapter.ai.parser.ReactiveChatAnswerStream;
import com.bibbidi.wedding.chat.adapter.ai.routing.ChatModelTier;
import com.bibbidi.wedding.chat.adapter.ai.routing.ModelClassifier;
import com.bibbidi.wedding.chat.adapter.ai.routing.ModelSelectPlan;
import com.bibbidi.wedding.chat.service.dto.result.ChatResult;
import com.bibbidi.wedding.chat.service.port.AiConversationPort;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.openai.errors.RateLimitException;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;
import software.amazon.awssdk.services.bedrockruntime.model.ThrottlingException;

@Component
public class SpringAiConversationAdapter implements AiConversationPort {

    private final SpringAiChatClient chatClient;
    private final JacksonChatAnswerParser answerParser;
    private final ChatMemory chatMemory;

    private final ModelClassifier classifier;

    @Autowired
    public SpringAiConversationAdapter(
            SpringAiChatClient chatClient,
            JacksonChatAnswerParser answerParser,
            ChatMemory chatMemory,
            ModelClassifier classifier
    ) {
        this.chatClient = chatClient;
        this.answerParser = answerParser;
        this.chatMemory = chatMemory;
        this.classifier = classifier;
    }

    @Override
    public Flux<ChatResult> stream(Long userId, String conversationKey, String userPrompt) {
        return mapModelErrors(Flux.defer(() -> {
                            ChatModelRequest request = new ChatModelRequest(
                                    userId, conversationKey, new UserMessage(userPrompt));
                            Mono<ModelSelectPlan> fallbackPlan = classifier.classify(conversationKey, userPrompt)
                                    .map(ModelSelectPlan::startingAt);
                            return fallbackPlan.flatMapMany(
                                    plan -> attempt(request, plan)
                            );
                        }
                )
        );
    }

    private Flux<ChatResult> mapModelErrors(Flux<ChatResult> results) {
        return results
                .onErrorMap(error -> hasCause(error, ThrottlingException.class),
                        error -> new BusinessException(
                                ClientError.AI_CAPACITY_EXCEEDED, "AI 호출 한도 초과", error))
                .onErrorMap(error -> hasCause(error, RateLimitException.class),
                        _ -> new BusinessException(
                                ClientError.AI_CAPACITY_EXCEEDED, "OpenAI 호출 한도 초과"))
                .onErrorMap(this::isEmptyAdvisorResponse,
                        error -> new BusinessException(
                                ClientError.INTERNAL_ERROR, "AI 응답 없음", error))
                .onErrorMap(error -> !(error instanceof BusinessException),
                        error -> new BusinessException(
                                ClientError.INTERNAL_ERROR,
                                "AI 모델 호출 실패. type=" + error.getClass().getSimpleName()));
    }

    private Flux<ChatResult> attempt(ChatModelRequest request, ModelSelectPlan plan) {
        return Flux.defer(() -> {
                    ChatModelTier tier = plan.tier();
                    List<Message> previousMessages = chatMemory.get(request.conversationKey());
                    AtomicBoolean sentDelta = new AtomicBoolean();
                    return Flux.concat(
                                    Flux.just(new ChatResult.Selected(tier)),
                                    streamAnswer(request, tier)
                            )
                            .doOnNext(result -> {
                                if (result instanceof ChatResult.Delta) {
                                    sentDelta.set(true);
                                }
                            })
                            .onErrorResume(error -> {
                                        if (sentDelta.get() || !plan.hasFallback()) {
                                            return Flux.error(error);
                                        }
                                        chatMemory.clear(request.conversationKey());
                                        chatMemory.add(request.conversationKey(), previousMessages);
                                        return attempt(request, plan.fallback());
                                    }
                            );
                }
        );
    }

    private Flux<ChatResult> streamAnswer(ChatModelRequest request, ChatModelTier tier) {
        return Flux.defer(() -> {
            ReactiveChatAnswerStream answer = answerParser.newSession();
            Flux<ChatResult> deltas = chatClient.streamReply(request, tier)
                    .map(this::textOf)
                    .filter(text -> !text.isEmpty())
                    .publishOn(Schedulers.boundedElastic()) // 사용 가능한 CPU 코어 수 * 10 개
                    .map(answer::acceptChunk)
                    .filter(delta -> !delta.isEmpty())
                    .map(ChatResult.Delta::new);
            return deltas.concatWith(Flux.defer(() -> Flux.just(answer.buildAnswer())));
        });
    }

    private String textOf(ChatResponse response) {
        if (response.getResult() == null || response.getResult().getOutput().getText() == null) {
            return "";
        }
        return response.getResult().getOutput().getText();
    }

    private boolean hasCause(Throwable error, Class<? extends Throwable> type) {
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (type.isInstance(cause)) {
                return true;
            }
        }
        return false;
    }

    private boolean isEmptyAdvisorResponse(Throwable exception) {
        return exception instanceof IllegalArgumentException
                && "conversationId cannot be null".equals(exception.getMessage());
    }
}
