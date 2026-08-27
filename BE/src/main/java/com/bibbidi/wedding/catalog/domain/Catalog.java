package com.bibbidi.wedding.catalog.domain;

import java.util.Comparator;
import java.util.List;
import org.jspecify.annotations.NonNull;

public final class Catalog {

    private final List<Category> categories;

    public Catalog(@NonNull List<Category> categories) {
        this.categories = sortByDisplayOrder(categories);
    }

    public List<Category> categories() {
        return categories;
    }

    private static List<Category> sortByDisplayOrder(List<Category> categories) {
        return categories.stream()
                .sorted(Comparator.comparingInt(Category::displayOrder))
                .toList();
    }
}
