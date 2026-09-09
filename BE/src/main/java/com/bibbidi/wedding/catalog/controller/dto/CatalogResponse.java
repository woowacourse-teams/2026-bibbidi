package com.bibbidi.wedding.catalog.controller.dto;

import com.bibbidi.wedding.catalog.domain.Catalog;
import java.util.List;

public record CatalogResponse(List<CategoryResponse> categories) {

    public static CatalogResponse from(Catalog catalog) {
        return new CatalogResponse(catalog.categories().stream()
                .map(CategoryResponse::from)
                .toList());
    }
}
