package com.bibbidi.wedding.catalog.domain;

import java.util.Objects;

public record Item(
        Long id,
        String title,
        int displayOrder,
        boolean essential
) {

    public Item {
        Objects.requireNonNull(id);
        Objects.requireNonNull(title);
    }
}
