package com.bibbidi.wedding.checklist.controller.dto;

import jakarta.validation.constraints.AssertTrue;

public record ChangeChecklistItemCompletionRequest(
        @AssertTrue(message = "할 일 완료는 isDone 이 true 여야 합니다.")
        boolean isDone
) {
}
