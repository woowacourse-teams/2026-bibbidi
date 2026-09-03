package com.bibbidi.wedding.appointment.controller.dto;

import jakarta.validation.constraints.NotNull;

public record ChangeAppointmentCompletionRequest(
        @NotNull(message = "완료 여부는 필수입니다.")
        Boolean isDone
) {
}
