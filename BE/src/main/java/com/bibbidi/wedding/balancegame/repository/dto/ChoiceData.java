package com.bibbidi.wedding.balancegame.repository.dto;

import com.bibbidi.wedding.balancegame.domain.BalanceGameQuestion.Choice;
import jakarta.validation.constraints.NotBlank;
import org.jspecify.annotations.Nullable;

public record ChoiceData(
        @NotBlank String id,
        @NotBlank String text,
        @Nullable String imagePath
) {

    public Choice toChoice() {
        return new Choice(id, text, imagePath);
    }
}
