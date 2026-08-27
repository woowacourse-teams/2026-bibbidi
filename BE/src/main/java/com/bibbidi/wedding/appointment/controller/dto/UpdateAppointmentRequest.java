package com.bibbidi.wedding.appointment.controller.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record UpdateAppointmentRequest(
        @NotBlank(message = "title은 비어 있을 수 없습니다.")
        @Size(max = 255, message = "title은 255자 이하여야 합니다.")
        String title,
        @NotNull(message = "date는 필수입니다.")
        LocalDate date,
        LocalDateTime startTime,
        LocalDateTime endTime,
        @Size(max = 255, message = "place는 255자 이하여야 합니다.")
        String place,
        String memo
) {

    @AssertTrue(message = "startTime은 endTime보다 빨라야 합니다.")
    public boolean hasValidTimeRange() {
        return startTime == null || endTime == null || startTime.isBefore(endTime);
    }
}
