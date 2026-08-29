package com.bibbidi.wedding.checklist.controller.dto;

import com.bibbidi.wedding.checklist.service.dto.ChecklistItemCategoryChangeResult;

public record ChangeChecklistItemCategoryResponse(
        Long id,
        Long catalogItemId,
        Long categoryId,
        String title,
        boolean isDone
) {

    public static ChangeChecklistItemCategoryResponse from(ChecklistItemCategoryChangeResult result) {
        return new ChangeChecklistItemCategoryResponse(
                result.id(),
                result.catalogItemId(),
                result.categoryId(),
                result.title(),
                result.isDone()
        );
    }
}
