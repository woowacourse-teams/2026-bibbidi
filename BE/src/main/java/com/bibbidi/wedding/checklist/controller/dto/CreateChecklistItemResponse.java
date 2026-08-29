package com.bibbidi.wedding.checklist.controller.dto;

import com.bibbidi.wedding.checklist.service.dto.ChecklistItemCreationResult;

public record CreateChecklistItemResponse(
        Long id,
        Long catalogItemId,
        Long categoryId,
        String title,
        boolean isDone
) {

    public static CreateChecklistItemResponse from(ChecklistItemCreationResult result) {
        return new CreateChecklistItemResponse(
                result.id(),
                result.catalogItemId(),
                result.categoryId(),
                result.title(),
                result.isDone()
        );
    }
}
