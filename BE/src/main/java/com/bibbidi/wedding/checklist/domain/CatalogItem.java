package com.bibbidi.wedding.checklist.domain;

import org.jspecify.annotations.Nullable;

public final class CatalogItem {

    private final Long id;
    private final Long categoryId;
    private final String title;
    private final String description;

    public CatalogItem(
            @Nullable Long id,
            Long categoryId,
            String title,
            String description
    ) {
        this.id = id;
        this.categoryId = categoryId;
        this.title = title;
        this.description = description;
    }

    public Long id() {
        return id;
    }

    public Long categoryId() {
        return categoryId;
    }

    public String title() {
        return title;
    }

    public String description() {
        return description;
    }
}
