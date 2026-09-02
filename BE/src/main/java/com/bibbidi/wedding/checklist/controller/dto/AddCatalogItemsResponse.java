package com.bibbidi.wedding.checklist.controller.dto;

import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import com.bibbidi.wedding.checklist.service.dto.CatalogItemAdditionResult;
import java.util.List;

public record AddCatalogItemsResponse(List<AddedChecklistItemResponse> items) {

    public static AddCatalogItemsResponse from(CatalogItemAdditionResult result) {
        return new AddCatalogItemsResponse(result.items().stream()
                .map(AddedChecklistItemResponse::from)
                .toList());
    }

    public record AddedChecklistItemResponse(
            Long id,
            Long catalogItemId,
            Long categoryId,
            String title,
            ChecklistItemStatus status
    ) {

        public static AddedChecklistItemResponse from(CatalogItemAdditionResult.AddedChecklistItem item) {
            return new AddedChecklistItemResponse(
                    item.id(),
                    item.catalogItemId(),
                    item.categoryId(),
                    item.title(),
                    item.status()
            );
        }
    }
}
