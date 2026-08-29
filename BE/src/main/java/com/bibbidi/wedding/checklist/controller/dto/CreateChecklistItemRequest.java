package com.bibbidi.wedding.checklist.controller.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateChecklistItemRequest(
        @NotBlank(message = "할 일 제목을 입력해야 합니다.")
        @Size(max = 50, message = "할 일 제목은 50자를 넘을 수 없습니다.")
        String title,

        @NotNull(message = "카테고리를 선택해야 합니다.")
        Long categoryId
) {

    public CreateChecklistItemRequest {
        if (title != null) {
            title = title.strip();
        }
    }
}
