package com.bibbidi.wedding.catalog.controller.dto;

import com.bibbidi.wedding.catalog.domain.Catalog;
import com.bibbidi.wedding.catalog.service.dto.CatalogQueryResult;
import java.util.List;

public record CatalogResponse(List<CategoryResponse> categories) {

    public static CatalogResponse from(CatalogQueryResult result) {
        return new CatalogResponse(result.catalog().categories().stream()
                .map(category -> CategoryResponse.fromDomain(
                        category,
                        result.includedCatalogItemIds()
                ))
                .toList());
    }

    public static CatalogResponse forPublic(Catalog catalog) {
        return new CatalogResponse(catalog.categories().stream()
                .map(CategoryResponse::forPublic)
                .toList());
    }
}
