package com.bibbidi.wedding.catalog.domain;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;

public record Step(
        Long id,
        String name,
        @Nullable String description,
        int displayOrder,
        List<Item> items
) {

    public Step {
        Objects.requireNonNull(id);
        Objects.requireNonNull(name);
        items = sortByDisplayOrder(items);
    }

    private static List<Item> sortByDisplayOrder(List<Item> items) {
        return List.copyOf(items).stream()
                .sorted(Comparator.comparingInt(Item::displayOrder))
                .toList();
    }
}
