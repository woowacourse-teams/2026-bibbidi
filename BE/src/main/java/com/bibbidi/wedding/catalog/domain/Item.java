package com.bibbidi.wedding.catalog.domain;

public record Item(
        Long id,
        String title,
        int displayOrder,
        boolean essential
) {
}
