package com.bibbidi.wedding.catalog.service.dto;

import com.bibbidi.wedding.catalog.domain.Catalog;
import java.util.Set;

public record CatalogQueryResult(
        Catalog catalog,
        Set<Long> includedCatalogItemIds
) {
}
