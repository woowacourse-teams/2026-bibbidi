package com.bibbidi.wedding.balancegame.domain;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.NonNull;

public final class Questions {

    private static final String EMPTY_QUESTIONS_MESSAGE = "밸런스게임 문항은 하나 이상 있어야 합니다.";
    private static final String DUPLICATE_ID_MESSAGE = "밸런스게임 문항 ID가 중복됩니다. ids=";
    private static final String NO_CURRENT_ANSWER_MESSAGE = "밸런스게임 답변에 현재 문항이 하나도 없습니다. questionIds=";

    private final List<Question> values;

    public Questions(@NonNull List<Question> values) {
        validateNotEmpty(values);
        validateUniqueIds(values);
        this.values = values;
    }

    public List<Answer> resolve(Map<String, String> optionIds) {
        List<Answer> answers = values.stream()
                .flatMap(question -> question.answerFrom(optionIds).stream())
                .toList();
        if (answers.isEmpty()) {
            throw new BusinessException(
                    ClientError.INVALID_REQUEST,
                    NO_CURRENT_ANSWER_MESSAGE + optionIds.keySet()
            );
        }

        return answers;
    }

    public List<Question> values() {
        return values;
    }

    private static void validateNotEmpty(List<Question> values) {
        if (values.isEmpty()) {
            throw new IllegalArgumentException(EMPTY_QUESTIONS_MESSAGE);
        }
    }

    private static void validateUniqueIds(List<Question> values) {
        List<String> ids = values.stream()
                .map(Question::id)
                .toList();
        if (ids.stream().distinct().count() != ids.size()) {
            throw new IllegalArgumentException(DUPLICATE_ID_MESSAGE + ids);
        }
    }
}
