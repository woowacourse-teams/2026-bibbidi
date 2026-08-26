package com.bibbidi.wedding.catalog.persistence;

public record CatalogRow(
        Long categoryId,
        String categoryName,
        int categoryDisplayOrder,
        Long stepId,
        String stepName,
        String stepDescription,
        Integer stepDisplayOrder,
        Long itemId,
        String itemTitle,
        Integer itemDisplayOrder,
        Boolean itemEssential
) {
}
