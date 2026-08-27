package com.bibbidi.wedding.catalog.domain;

import java.util.Comparator;
import java.util.List;
import org.jspecify.annotations.NonNull;
import org.jspecify.annotations.Nullable;

public final class Step {

    private final Long id;
    private final String name;
    private final String description;
    private final int displayOrder;
    private final List<Item> items;

    public Step(
            @Nullable Long id,
            @NonNull String name,
            @Nullable String description,
            int displayOrder,
            @NonNull List<Item> items
    ) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.displayOrder = displayOrder;
        this.items = sortByDisplayOrder(items);
    }

    public Long id() {
        return id;
    }

    public String name() {
        return name;
    }

    @Nullable
    public String description() {
        return description;
    }

    public int displayOrder() {
        return displayOrder;
    }

    public List<Item> items() {
        return items;
    }

    private static List<Item> sortByDisplayOrder(List<Item> items) {
        return items.stream()
                .sorted(Comparator.comparingInt(Item::displayOrder))
                .toList();
    }
}
