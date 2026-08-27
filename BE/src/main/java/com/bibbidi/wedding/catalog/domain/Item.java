package com.bibbidi.wedding.catalog.domain;

import org.jspecify.annotations.NonNull;

public final class Item {

    private final Long id;
    private final String title;
    private final int displayOrder;
    private final boolean essential;

    public Item(
            @NonNull Long id,
            @NonNull String title,
            int displayOrder,
            boolean essential
    ) {
        this.id = id;
        this.title = title;
        this.displayOrder = displayOrder;
        this.essential = essential;
    }

    public Long id() {
        return id;
    }

    public String title() {
        return title;
    }

    public int displayOrder() {
        return displayOrder;
    }

    public boolean essential() {
        return essential;
    }
}
