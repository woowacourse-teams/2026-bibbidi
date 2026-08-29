package com.bibbidi.wedding.checklist.controller.dto;

import jakarta.validation.constraints.NotNull;

public record ChangeChecklistItemCategoryRequest(
        @NotNull(message = "카테고리를 선택해야 합니다.")
        Long categoryId
) {
}
