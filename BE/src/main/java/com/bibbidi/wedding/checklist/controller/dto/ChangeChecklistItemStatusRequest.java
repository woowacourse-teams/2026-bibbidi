package com.bibbidi.wedding.checklist.controller.dto;

import jakarta.validation.constraints.NotNull;

public record ChangeChecklistItemStatusRequest(
        @NotNull(message = "할 일 상태를 선택해야 합니다.")
        String status
) {
}
