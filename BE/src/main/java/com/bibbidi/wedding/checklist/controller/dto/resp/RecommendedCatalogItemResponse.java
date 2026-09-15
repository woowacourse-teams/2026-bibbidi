package com.bibbidi.wedding.checklist.controller.dto.resp;

import com.bibbidi.wedding.checklist.service.dto.RecommendedCatalogItemResult;

public record RecommendedCatalogItemResponse(
        Long catalogItemId,
        String title,
        String categoryName,
        int phase,
        String stepName
) {

    public static RecommendedCatalogItemResponse from(RecommendedCatalogItemResult result) {
        return new RecommendedCatalogItemResponse(
                result.catalogItemId(),
                result.title(),
                result.categoryName(),
                result.phase(),
                result.stepName()
        );
    }
}
