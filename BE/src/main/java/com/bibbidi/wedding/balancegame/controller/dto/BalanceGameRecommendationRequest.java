package com.bibbidi.wedding.balancegame.controller.dto;

import com.bibbidi.wedding.balancegame.service.dto.BalanceGameAnswer;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.List;

public record BalanceGameRecommendationRequest(
        @NotEmpty List<@NotNull @Valid Answer> answers
) {

    public List<BalanceGameAnswer> toAnswers() {
        return answers.stream()
                .map(answer -> new BalanceGameAnswer(answer.questionId(), answer.optionId()))
                .toList();
    }

    public record Answer(@NotNull @Positive Long questionId, @NotBlank String optionId) {
    }
}
