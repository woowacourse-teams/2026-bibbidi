package com.bibbidi.wedding.balancegame.repository.dto;

import com.bibbidi.wedding.balancegame.domain.BalanceGameQuestion.Choice;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.jspecify.annotations.Nullable;

public record ChoiceData(
        @NotBlank String id,
        @NotBlank String text,
        @Nullable
        @Pattern(regexp = "/balance-game/[a-zA-Z0-9_-]+\\.webp", message = "/balance-game/파일명.webp 형식이어야 합니다")
        String imagePath
) {

    public Choice toChoice() {
        return new Choice(id, text, imagePath);
    }
}
