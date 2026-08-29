package com.bibbidi.wedding.checklist.service.dto;

import com.bibbidi.wedding.checklist.domain.ChecklistItem;

public record ChecklistItemCategoryChangeResult(
        Long id,
        Long catalogItemId,
        Long categoryId,
        String title,
        boolean isDone
) {

    public static ChecklistItemCategoryChangeResult from(ChecklistItem item) {
        return new ChecklistItemCategoryChangeResult(
                item.id(),
                item.sourceCatalogItemId(),
                item.categoryId(),
                item.title(),
                item.isDone()
        );
    }
}
