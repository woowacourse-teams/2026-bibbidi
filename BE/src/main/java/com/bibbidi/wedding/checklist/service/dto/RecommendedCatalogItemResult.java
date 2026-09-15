package com.bibbidi.wedding.checklist.service.dto;

import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;

public record RecommendedCatalogItemResult(
        Long catalogItemId,
        String title,
        String categoryName,
        int phase,
        String stepName
) {

    public static RecommendedCatalogItemResult from(CatalogItemDetailSnapshot itemDetail) {
        return new RecommendedCatalogItemResult(
                itemDetail.id(),
                itemDetail.title(),
                itemDetail.categoryName(),
                itemDetail.phase(),
                itemDetail.stepName()
        );
    }
}
