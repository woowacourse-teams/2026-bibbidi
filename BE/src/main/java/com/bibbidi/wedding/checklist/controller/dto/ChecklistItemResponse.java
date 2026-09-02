package com.bibbidi.wedding.checklist.controller.dto;

import com.bibbidi.wedding.checklist.service.dto.ChecklistItemResult;

public record ChecklistItemResponse(
        Long id,
        Long catalogItemId,
        Long categoryId,
        String title,
        String status
) {

    public static ChecklistItemResponse from(ChecklistItemResult result) {
        return new ChecklistItemResponse(
                result.id(),
                result.catalogItemId(),
                result.categoryId(),
                result.title(),
                result.status().value()
        );
    }
}
