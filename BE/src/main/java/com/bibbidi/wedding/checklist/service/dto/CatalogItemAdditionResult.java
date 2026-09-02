package com.bibbidi.wedding.checklist.service.dto;

import com.bibbidi.wedding.checklist.domain.ChecklistItem;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import java.util.List;

public record CatalogItemAdditionResult(List<AddedChecklistItem> items) {

    public static CatalogItemAdditionResult from(List<ChecklistItem> items) {
        return new CatalogItemAdditionResult(items.stream()
                .map(AddedChecklistItem::from)
                .toList());
    }

    public record AddedChecklistItem(
            Long id,
            Long catalogItemId,
            Long categoryId,
            String title,
            ChecklistItemStatus status
    ) {

        public static AddedChecklistItem from(ChecklistItem item) {
            return new AddedChecklistItem(
                    item.id(),
                    item.sourceCatalogItemId(),
                    item.categoryId(),
                    item.title(),
                    item.status()
            );
        }
    }
}
