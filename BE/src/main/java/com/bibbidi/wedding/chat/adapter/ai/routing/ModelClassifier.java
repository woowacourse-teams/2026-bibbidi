package com.bibbidi.wedding.chat.adapter.ai.routing;

import com.bibbidi.wedding.chat.adapter.ai.routing.JevClient.Question;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.MessageType;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

@Component
@Slf4j
public class ModelClassifier {

    private static final String QUESTION_ID = "route";

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

    public Mono<ChatModelTier> classify(String conversationKey, String userPrompt) {
        if (properties.apiKey() == null || properties.apiKey().isBlank()) {
            return Mono.just(ChatModelTier.HIGH);
        }

        return Mono.fromSupplier(() -> decide(conversationKey, userPrompt))
                .subscribeOn(Schedulers.boundedElastic())
                .onErrorResume(error -> {
                            log.warn(
                                    "Jev 분류 실패. 기본 HIGH 으로 처리합니다. type={}",
                                    error.getClass().getSimpleName()
                            );
                            return Mono.just(ChatModelTier.HIGH);
                        }
                );
    }

    private ChatModelTier decide(String conversationKey, String userPrompt) {
        Question question = new Question(
                QUESTION_ID,
                state(conversationKey, userPrompt),
                instruction.text(),
                criteria.byChoice()
        );

        JevClient.Choice answer = jev.choose(question);
        ChatModelTier choice = ChatModelTier.fromChoice(answer.value())
                .orElseThrow(() -> new BusinessException(
                        ClientError.INTERNAL_ERROR, "Jev 선택지가 없거나 유효하지 않습니다. choice=" + answer.value()));
        return answer.isUnsure(properties.minConfidence()) ? choice.higher() : choice;
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
}
