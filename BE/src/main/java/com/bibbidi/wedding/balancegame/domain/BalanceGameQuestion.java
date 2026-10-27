package com.bibbidi.wedding.balancegame.domain;

import java.util.List;
import org.jspecify.annotations.NonNull;
import org.jspecify.annotations.Nullable;

public record BalanceGameQuestion(
        @NonNull Long id,
        int order,
        @NonNull String question,
        @NonNull List<Choice> options
) {

    public BalanceGameQuestion {
        options = List.copyOf(options);
    }

    public record Choice(
            @NonNull String id,
            @NonNull String text,
            @Nullable String imageUrl
    ) {
    }
}
