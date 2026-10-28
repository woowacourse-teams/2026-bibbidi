package com.bibbidi.wedding.balancegame.repository.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record QuestionFile(
        @NotEmpty List<@NotNull @Valid QuestionData> questions
) {
}
