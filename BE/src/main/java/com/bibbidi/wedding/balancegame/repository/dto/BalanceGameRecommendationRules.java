package com.bibbidi.wedding.balancegame.repository.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.List;

public record BalanceGameRecommendationRules(
        @NotNull List<@NotNull @Positive Long> baseItemIds,
        @NotEmpty List<@NotNull @Valid QuestionRecommendationRule> rules
) {
}
