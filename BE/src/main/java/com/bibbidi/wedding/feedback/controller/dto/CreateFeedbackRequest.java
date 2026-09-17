package com.bibbidi.wedding.feedback.controller.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateFeedbackRequest(
        @NotBlank(message = "평가값은 필수입니다.")
        String sentiment,

        @Size(max = 255, message = "content는 255자 이하여야 합니다.")
        String content
) {
}
