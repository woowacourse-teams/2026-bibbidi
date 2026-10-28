package com.bibbidi.wedding.balancegame.domain;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.jspecify.annotations.NonNull;
import org.jspecify.annotations.Nullable;

public record BalanceGameQuestion(
        @NonNull Long id,
        int order,
        @NonNull String content,
        @NonNull List<Choice> choices
) {

    public BalanceGameQuestion {
        choices = List.copyOf(choices);
        Set<String> choiceIds = new HashSet<>();
        for (Choice choice : choices) {
            if (!choiceIds.add(choice.id())) {
                throw new IllegalStateException("밸런스게임 선택지 ID가 중복됩니다: questionId="
                        + id + ", choiceId=" + choice.id());
            }
        }
    }

    public Optional<Choice> findChoice(String choiceId) {
        return choices.stream()
                .filter(choice -> choice.id().equals(choiceId))
                .findFirst();
    }

    public record Choice(
            @NonNull String id,
            @NonNull String text,
            @Nullable String imagePath
    ) {
    }
}
