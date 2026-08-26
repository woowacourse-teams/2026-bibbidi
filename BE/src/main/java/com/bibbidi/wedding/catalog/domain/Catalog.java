package com.bibbidi.wedding.catalog.domain;

import java.util.Comparator;
import java.util.List;

public final class Catalog {

    private final List<Category> categories;

    public Catalog(List<Category> categories) {
        this.categories = sortByDisplayOrder(categories);
    }

    public List<Category> categories() {
        return categories;
    }

    private static List<Category> sortByDisplayOrder(List<Category> categories) {
        return List.copyOf(categories).stream()
                .sorted(Comparator.comparingInt(Category::displayOrder))
                .toList();
    }
}
