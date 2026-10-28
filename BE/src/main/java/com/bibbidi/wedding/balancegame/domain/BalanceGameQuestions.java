package com.bibbidi.wedding.balancegame.domain;

import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.jspecify.annotations.NonNull;

public record BalanceGameQuestions(@NonNull List<BalanceGameQuestion> values) {

    public BalanceGameQuestions {
        validateDuplicates(values);
        values = values.stream()
                .sorted(Comparator.comparingInt(BalanceGameQuestion::order))
                .toList();
    }

    public Optional<BalanceGameQuestion> findById(Long questionId) {
        return values.stream()
                .filter(question -> question.id().equals(questionId))
                .findFirst();
    }

    private static void validateDuplicates(List<BalanceGameQuestion> questions) {
        Set<Long> questionIds = new HashSet<>();
        Set<Integer> orders = new HashSet<>();
        for (BalanceGameQuestion question : questions) {
            if (!questionIds.add(question.id())) {
                throw new IllegalStateException("밸런스게임 문항 ID가 중복됩니다: id=" + question.id());
            }
            if (!orders.add(question.order())) {
                throw new IllegalStateException("밸런스게임 문항 노출 순서가 중복됩니다: order=" + question.order());
            }
        }
    }
}
