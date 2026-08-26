package com.bibbidi.wedding.catalog.domain;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;

public record Category(
        Long id,
        String name,
        int displayOrder,
        List<Step> steps
) {

    public Category {
        Objects.requireNonNull(id);
        Objects.requireNonNull(name);
        steps = sortByDisplayOrder(steps);
    }

    private static List<Step> sortByDisplayOrder(List<Step> steps) {
        return List.copyOf(steps).stream()
                .sorted(Comparator.comparingInt(Step::displayOrder))
                .toList();
    }
}
