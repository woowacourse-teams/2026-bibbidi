package com.bibbidi.wedding.checklist.service.dto;

import com.bibbidi.wedding.checklist.domain.ChecklistItem;

public record ChecklistItemCreationResult(
        Long id,
        Long catalogItemId,
        Long categoryId,
        String title,
        boolean isDone
) {

    public static ChecklistItemCreationResult from(ChecklistItem item) {
        return new ChecklistItemCreationResult(
                item.id(),
                item.sourceCatalogItemId(),
                item.categoryId(),
                item.title(),
                item.isDone()
        );
    }
}
