package com.bibbidi.wedding.catalog.domain;

import java.util.Comparator;
import java.util.List;
import org.jspecify.annotations.NonNull;
import org.jspecify.annotations.Nullable;

public final class Category {

    private final Long id;
    private final String name;
    private final int displayOrder;
    private final List<Step> steps;

    public Category(
            @Nullable Long id,
            @NonNull String name,
            int displayOrder,
            @NonNull List<Step> steps
    ) {
        this.id = id;
        this.name = name;
        this.displayOrder = displayOrder;
        this.steps = sortByDisplayOrder(steps);
    }

    public Long id() {
        return id;
    }

    public String name() {
        return name;
    }

    public int displayOrder() {
        return displayOrder;
    }

    public List<Step> steps() {
        return steps;
    }

    private static List<Step> sortByDisplayOrder(List<Step> steps) {
        return steps.stream()
                .sorted(Comparator.comparingInt(Step::displayOrder))
                .toList();
    }
}
