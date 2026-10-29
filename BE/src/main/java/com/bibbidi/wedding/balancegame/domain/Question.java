package com.bibbidi.wedding.balancegame.domain;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public record Question(
        String id,
        String text,
        List<Option> options
) {

    private static final String DUPLICATE_OPTION_ID_MESSAGE = "밸런스게임 문항에 중복된 선택지 ID가 있습니다. questionId=";
    private static final String UNKNOWN_OPTION_MESSAGE = "밸런스게임 문항에 없는 선택지입니다. questionId=%s, optionId=%s";

    public Question {
        validateUniqueOptionIds(id, options);
    }

    public Optional<Answer> answerFrom(Map<String, String> optionIds) {
        if (!optionIds.containsKey(id)) {
            return Optional.empty();
        }

        return Optional.of(new Answer(this, select(optionIds.get(id))));
    }

    private Option select(String optionId) {
        return options.stream()
                .filter(option -> option.hasId(optionId))
                .findFirst()
                .orElseThrow(() -> new BusinessException(
                        ClientError.INVALID_REQUEST,
                        UNKNOWN_OPTION_MESSAGE.formatted(id, optionId)
                ));
    }

    private static void validateUniqueOptionIds(String id, List<Option> options) {
        long uniqueCount = options.stream()
                .map(Option::id)
                .distinct()
                .count();
        if (uniqueCount != options.size()) {
            throw new IllegalArgumentException(DUPLICATE_OPTION_ID_MESSAGE + id);
        }
    }
}
