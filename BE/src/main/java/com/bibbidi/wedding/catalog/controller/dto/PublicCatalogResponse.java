package com.bibbidi.wedding.catalog.controller.dto;

import com.bibbidi.wedding.catalog.domain.Catalog;
import java.util.List;

public record PublicCatalogResponse(List<PublicCategoryResponse> categories) {

    public static PublicCatalogResponse from(Catalog catalog) {
        return new PublicCatalogResponse(catalog.categories().stream()
                .map(PublicCategoryResponse::fromDomain)
                .toList());
    }
}
