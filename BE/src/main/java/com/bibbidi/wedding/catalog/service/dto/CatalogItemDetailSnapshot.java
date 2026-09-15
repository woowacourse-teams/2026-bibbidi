package com.bibbidi.wedding.catalog.service.dto;

public record CatalogItemDetailSnapshot(
        Long id,
        String title,
        String categoryName,
        int phase,
        String stepName
) {
}
