package com.bibbidi.wedding.balancegame.adapter.ai;

import com.bibbidi.wedding.balancegame.domain.Answer;
import com.bibbidi.wedding.balancegame.domain.WeddingType;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.bedrockruntime.model.ThrottlingException;

@Component
public class SpringAiWeddingTypeClassifier {

    private static final String UNKNOWN_TYPE_MESSAGE = "AI가 후보에 없는 밸런스게임 유형을 골랐습니다. typeId=";
    private static final String CAPACITY_EXCEEDED_MESSAGE = "밸런스게임 AI 호출 한도를 넘었습니다.";
    private static final String CALL_FAILURE_MESSAGE = "밸런스게임 AI 호출에 실패했습니다. type=";
    private static final String USER_MESSAGE_FORMAT = "[답변]\n%s\n\n[유형]\n%s";
    private static final String ANSWER_LINE_FORMAT = "- %s → %s";
    private static final String TYPE_LINE_FORMAT = "- %s: %s (%s)";
    private static final String LINE_DELIMITER = "\n";

    private final ChatClient client;

    public SpringAiWeddingTypeClassifier(
            ChatClient.Builder chatClientBuilder,
            @Value("classpath:prompts/balance-game-system.txt") Resource systemPrompt
    ) {
        this.client = chatClientBuilder.defaultSystem(systemPrompt, StandardCharsets.UTF_8).build();
    }

    public WeddingType classify(List<Answer> answers, List<WeddingType> candidates) {
        String typeId = requestTypeId(answers, candidates);

        return candidates.stream()
                .filter(type -> type.hasId(typeId))
                .findFirst()
                .orElseThrow(() -> new BusinessException(
                        ClientError.INTERNAL_ERROR,
                        UNKNOWN_TYPE_MESSAGE + typeId
                ));
    }

    private String requestTypeId(List<Answer> answers, List<WeddingType> candidates) {
        try {
            return client.prompt()
                    .user(userMessage(answers, candidates))
                    .call()
                    .entity(Output.class)
                    .typeId();
        } catch (RuntimeException exception) {
            if (hasCause(exception, ThrottlingException.class)) {
                throw new BusinessException(ClientError.AI_CAPACITY_EXCEEDED, CAPACITY_EXCEEDED_MESSAGE, exception);
            }
            throw new BusinessException(
                    ClientError.INTERNAL_ERROR,
                    CALL_FAILURE_MESSAGE + exception.getClass().getSimpleName()
            );
        }
    }

    private String userMessage(List<Answer> answers, List<WeddingType> candidates) {
        String answerLines = answers.stream()
                .map(answer -> ANSWER_LINE_FORMAT.formatted(answer.questionText(), answer.selectedText()))
                .collect(Collectors.joining(LINE_DELIMITER));
        String typeLines = candidates.stream()
                .map(type -> TYPE_LINE_FORMAT.formatted(type.id(), type.name(), type.summary()))
                .collect(Collectors.joining(LINE_DELIMITER));

        return USER_MESSAGE_FORMAT.formatted(answerLines, typeLines);
    }

    private boolean hasCause(Throwable error, Class<? extends Throwable> type) {
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (type.isInstance(cause)) {
                return true;
            }
        }
        return false;
    }

    record Output(String typeId) {
    }
}
