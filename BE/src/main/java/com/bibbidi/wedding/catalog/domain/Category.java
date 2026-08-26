package com.bibbidi.wedding.catalog.domain;

import java.util.Comparator;
import java.util.List;

public record Category(
        Long id,
        String name,
        int displayOrder,
        List<Step> steps
) {

    public Category {
        steps = sortByDisplayOrder(steps);
    }

    private static List<Step> sortByDisplayOrder(List<Step> steps) {
        return steps.stream()
                .sorted(Comparator.comparingInt(Step::displayOrder))
                .toList();
    }
}
