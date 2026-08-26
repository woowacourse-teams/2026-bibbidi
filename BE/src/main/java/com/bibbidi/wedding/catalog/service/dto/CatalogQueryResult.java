package com.bibbidi.wedding.catalog.service.dto;

import com.bibbidi.wedding.catalog.domain.Catalog;
import java.util.List;
import java.util.Set;

public record CatalogQueryResult(List<CategoryResult> categories) {

    public static CatalogQueryResult fromDomain(Catalog catalog, Set<Long> includedItemIds) {
        return new CatalogQueryResult(catalog.categories().stream()
                .map(category -> CategoryResult.fromDomain(category, includedItemIds))
                .toList());
    }
}
