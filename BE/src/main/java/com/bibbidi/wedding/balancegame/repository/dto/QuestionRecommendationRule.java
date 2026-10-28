package com.bibbidi.wedding.balancegame.repository.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.List;
import java.util.Map;

public record QuestionRecommendationRule(
        @NotNull @Positive Long questionId,
        @NotEmpty Map<@NotBlank String, @NotNull List<@NotNull @Positive Long>> optionItemIds
) {
}
