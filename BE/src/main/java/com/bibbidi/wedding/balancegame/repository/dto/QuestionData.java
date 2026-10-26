package com.bibbidi.wedding.balancegame.repository.dto;

import com.bibbidi.wedding.balancegame.domain.BalanceGameQuestion;
import com.bibbidi.wedding.balancegame.domain.BalanceGameQuestion.Choice;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.List;

public record QuestionData(
        @NotNull @Positive Long id,
        @NotNull @Positive Integer order,
        @NotBlank String question,
        @NotEmpty List<@NotNull @Valid Choice> options
) {

    public BalanceGameQuestion toQuestion() {
        return new BalanceGameQuestion(id, order, question, options);
    }
}
