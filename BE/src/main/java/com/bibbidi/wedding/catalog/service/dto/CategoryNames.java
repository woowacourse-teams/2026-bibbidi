package com.bibbidi.wedding.catalog.service.dto;

import java.util.Map;

public record CategoryNames(Map<Long, String> namesByCategoryId) {

    public boolean contains(Long categoryId) {
        return namesByCategoryId.containsKey(categoryId);
    }

    public String nameOf(Long categoryId) {
        return namesByCategoryId.get(categoryId);
    }
}
