package com.bibbidi.wedding.catalog.domain;

import java.util.Comparator;
import java.util.List;
import org.jspecify.annotations.Nullable;

public record Step(
        Long id,
        String name,
        @Nullable String description,
        int displayOrder,
        List<Item> items
) {

    public Step {
        items = sortByDisplayOrder(items);
    }

    private static List<Item> sortByDisplayOrder(List<Item> items) {
        return items.stream()
                .sorted(Comparator.comparingInt(Item::displayOrder))
                .toList();
    }
}
