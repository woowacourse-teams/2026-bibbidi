package com.bibbidi.wedding.checklist.controller.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangeChecklistItemTitleRequest(
        @NotBlank(message = "할 일 제목을 입력해야 합니다.")
        @Size(max = 50, message = "할 일 제목은 50자를 넘을 수 없습니다.")
        String title
) {

    public ChangeChecklistItemTitleRequest {
        if (title != null) {
            title = title.strip();
        }
    }
}
