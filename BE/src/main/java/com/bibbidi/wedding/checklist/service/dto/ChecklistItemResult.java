package com.bibbidi.wedding.checklist.service.dto;

import com.bibbidi.wedding.checklist.domain.ChecklistItem;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import java.time.LocalDateTime;

public record ChecklistItemResult(
        Long id,
        Long catalogItemId,
        Long categoryId,
        String title,
        ChecklistItemStatus status,
        LocalDateTime createdAt
) {

    public static ChecklistItemResult from(ChecklistItem item) {
        return new ChecklistItemResult(
                item.id(),
                item.sourceCatalogItemId(),
                item.categoryId(),
                item.title(),
                item.status(),
                item.createdAt()
        );
    }
}
