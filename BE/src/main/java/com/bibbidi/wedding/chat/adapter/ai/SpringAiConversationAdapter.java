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
import com.openai.errors.OpenAIException;
import com.openai.errors.RateLimitException;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.retry.NonTransientAiException;
import org.springframework.ai.retry.TransientAiException;
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
    private final ChatMemory chatMemory;

    private final ModelClassifier classifier;
    private final String forcedTier;

    @Autowired
    public SpringAiConversationAdapter(
            SpringAiChatClient chatClient,
            JacksonChatAnswerParser answerParser,
            ChatMemory chatMemory,
            ModelClassifier classifier,
            @Value("${bibbidi.ai.chatbot.routing.forced-tier:}") String forcedTier
    ) {
        this.chatClient = chatClient;
        this.answerParser = answerParser;
        this.chatMemory = chatMemory;
        this.classifier = classifier;
        this.forcedTier = forcedTier;
    }

    @Override
    public Flux<ChatResult> stream(Long userId, String conversationKey, String userPrompt) {
        return mapModelErrors(Flux.defer(() -> {
            UserMessage userMessage = new UserMessage(userPrompt);
            Mono<ChatModelTier> selection = forcedTier.isBlank()
                    ? classifier.classify(conversationKey, userPrompt)
                    : Mono.just(ChatModelTier.valueOf(forcedTier.toUpperCase()));
            return selection.flatMapMany(tier -> attempt(
                    userId, conversationKey, userMessage, tier.fallbackOrder(), 0));
        }));
    }

    private static Flux<ChatResult> mapModelErrors(Flux<ChatResult> results) {
        return results
                .onErrorMap(SpringAiConversationAdapter::isThrottled,
                        exception -> new BusinessException(
                                ClientError.AI_CAPACITY_EXCEEDED, "AI 호출 한도 초과", exception))
                .onErrorMap(SpringAiConversationAdapter::isRateLimited,
                        exception -> new BusinessException(
                                ClientError.AI_CAPACITY_EXCEEDED, "OpenAI 호출 한도 초과"))
                .onErrorMap(exception -> exception instanceof TransientAiException
                                || exception instanceof NonTransientAiException
                                || exception instanceof OpenAIException,
                        exception -> new BusinessException(
                                ClientError.INTERNAL_ERROR,
                                "AI 모델 공급자 오류. type=" + exception.getClass().getSimpleName()))
                .onErrorMap(SpringAiConversationAdapter::isEmptyAdvisorResponse,
                        exception -> new BusinessException(
                                ClientError.INTERNAL_ERROR, "AI 응답 없음", exception))
                .onErrorMap(exception -> !(exception instanceof BusinessException),
                        exception -> new BusinessException(
                                ClientError.INTERNAL_ERROR,
                                "AI 모델 호출 실패. type=" + exception.getClass().getSimpleName()));
    }

    private Flux<ChatResult> attempt(Long userId, String conversationKey, UserMessage userMessage,
                                     List<ChatModelTier> order, int index) {
        return Flux.defer(() -> {
            ChatModelTier tier = order.get(index);
            List<Message> previousMessages = chatMemory.get(conversationKey);
            AtomicBoolean sentDelta = new AtomicBoolean();
            return Flux.concat(
                            Flux.just(new ChatResult.Selected(chatClient.modelName(tier))),
                            streamAnswer(new ChatModelRequest(userId, conversationKey, userMessage, tier))
                    )
                    .doOnNext(result -> {
                        if (result instanceof ChatResult.Delta) {
                            sentDelta.set(true);
                        }
                    })
                    .onErrorResume(error -> {
                        if (sentDelta.get() || index + 1 == order.size()) {
                            return Flux.error(error);
                        }
                        chatMemory.clear(conversationKey);
                        chatMemory.add(conversationKey, previousMessages);
                        return attempt(userId, conversationKey, userMessage, order, index + 1);
                    });
        });
    }

    private Flux<ChatResult> streamAnswer(ChatModelRequest request) {
        return Flux.defer(() -> {
            ReactiveChatAnswerStream answer = answerParser.newSession();
            Flux<ChatResult> deltas = chatClient.streamReply(request)
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

    private static boolean isRateLimited(Throwable exception) {
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause instanceof RateLimitException) {
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
