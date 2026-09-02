package com.bibbidi.wedding.checklist.service.dto;

import com.bibbidi.wedding.checklist.domain.ChecklistItem;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;

public record ChecklistItemResult(
        Long id,
        Long catalogItemId,
        Long categoryId,
        String title,
        ChecklistItemStatus status
) {

    public static ChecklistItemResult from(ChecklistItem item) {
        return new ChecklistItemResult(
                item.id(),
                item.sourceCatalogItemId(),
                item.categoryId(),
                item.title(),
                item.status()
        );
    }
}
