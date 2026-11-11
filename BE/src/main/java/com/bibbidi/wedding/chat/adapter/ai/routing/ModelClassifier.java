package com.bibbidi.wedding.chat.adapter.ai.routing;

import com.bibbidi.wedding.chat.adapter.ai.routing.JevClient.Choice;
import com.bibbidi.wedding.chat.adapter.ai.routing.JevClient.Question;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.MessageType;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

@Component
@Slf4j
public class ModelClassifier {

    private static final String ROUTE_QUESTION_ID = "route";
    private static final String INJECTION_QUESTION_ID = "injection";
    private static final String HIJACK_QUESTION_ID = "hijack";

    private final ChatMemory memory;
    private final ModelRoutingProperties properties;
    private final JevClient jev;
    private final ModelRoutingInstruction instruction;
    private final ModelRoutingCriteria criteria;

    public ModelClassifier(
            ChatMemory memory,
            ModelRoutingProperties properties,
            JevClient jev,
            ModelRoutingInstruction instruction,
            ModelRoutingCriteria criteria
    ) {
        this.memory = memory;
        this.properties = properties;
        this.jev = jev;
        this.instruction = instruction;
        this.criteria = criteria;
    }

    public Mono<Classification> classify(String conversationKey, String userPrompt) {
        if (properties.apiKey() == null || properties.apiKey().isBlank()) {
            return Mono.just(Classification.allow(ChatModelTier.HIGH));
        }

        return Mono.fromSupplier(() -> decide(conversationKey, userPrompt))
                .subscribeOn(Schedulers.boundedElastic())
                .onErrorResume(error -> {
                            log.warn(
                                    "Jev 분류 실패. 기본 HIGH 으로 처리합니다. type={}",
                                    error.getClass().getSimpleName()
                            );
                            return Mono.just(Classification.allow(ChatModelTier.HIGH));
                        }
                );
    }

    private Classification decide(String conversationKey, String userPrompt) {
        String currentState = state(conversationKey, userPrompt);
        List<Question> questions = List.of(
                new Question(ROUTE_QUESTION_ID, currentState, instruction.route(), criteria.route()),
                new Question(INJECTION_QUESTION_ID, currentState, instruction.injection(), criteria.injection()),
                new Question(HIJACK_QUESTION_ID, currentState, instruction.hijack(), criteria.hijack())
        );

        Map<String, Choice> answers = jev.choose(currentState, questions);
        ChatModelTier tier = decideTier(answers.get(ROUTE_QUESTION_ID));
        String injection = decideGuard(answers.get(INJECTION_QUESTION_ID), criteria.injection());
        String hijack = decideGuard(answers.get(HIJACK_QUESTION_ID), criteria.hijack());
        return new Classification(tier, injection, hijack);
    }

    private ChatModelTier decideTier(Choice answer) {
        String value = answer == null ? "" : answer.value();
        ChatModelTier choice = ChatModelTier.fromChoice(value)
                .orElseThrow(() -> new BusinessException(
                        ClientError.INTERNAL_ERROR, "Jev 선택지가 없거나 유효하지 않습니다. choice=" + value));
        return answer.isUnsure(properties.minConfidence()) ? choice.higher() : choice;
    }

    private String decideGuard(Choice answer, Map<String, String> allowedCriteria) {
        if (answer == null || !allowedCriteria.containsKey(answer.value())) {
            return Classification.NONE;
        }
        return answer.value();
    }

    private String state(String conversationKey, String userPrompt) {
        List<String> lines = new ArrayList<>(
                getRecentConversationFromChatMemory(conversationKey)
        );
        lines.add("user: " + userPrompt);
        return String.join("\n", lines);
    }

    private List<String> getRecentConversationFromChatMemory(String conversationKey) {
        return memory.get(conversationKey)
                .stream()
                .filter(message -> message.getMessageType() != MessageType.SYSTEM)
                .filter(message -> message.getMessageType() != MessageType.TOOL)
                .map(message -> message.getMessageType().getValue() + ": " + message.getText())
                .toList();
    }

    public record Classification(ChatModelTier tier, String injection, String hijack) {

        public static final String NONE = "none";
        public static final String MIXED = "mixed";

        public static Classification allow(ChatModelTier tier) {
            return new Classification(tier, NONE, NONE);
        }

        public boolean isBlocked() {
            return !NONE.equals(injection) || (!NONE.equals(hijack) && !MIXED.equals(hijack));
        }
    }
}
