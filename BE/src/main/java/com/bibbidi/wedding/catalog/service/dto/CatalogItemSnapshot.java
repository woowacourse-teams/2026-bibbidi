package com.bibbidi.wedding.catalog.service.dto;

public record CatalogItemSnapshot(
        Long id,
        Long categoryId,
        String title
) {
}
