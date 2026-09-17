package com.bibbidi.wedding.user.controller.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record WeddingDateRequest(
        @NotNull(message = "결혼 예정일은 비어 있을 수 없습니다.")
        LocalDate weddingDate
) {
}
