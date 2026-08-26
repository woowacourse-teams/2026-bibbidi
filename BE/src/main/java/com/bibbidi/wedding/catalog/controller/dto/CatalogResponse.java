package com.bibbidi.wedding.catalog.controller.dto;

import com.bibbidi.wedding.catalog.service.dto.CatalogQueryResult;
import java.util.List;

public record CatalogResponse(List<CategoryResponse> categories) {

    public static CatalogResponse from(CatalogQueryResult result) {
        return new CatalogResponse(result.categories().stream()
                .map(CategoryResponse::from)
                .toList());
    }
}
