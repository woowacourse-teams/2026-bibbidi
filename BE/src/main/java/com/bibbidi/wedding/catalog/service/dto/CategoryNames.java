package com.bibbidi.wedding.catalog.service.dto;

import java.util.Map;

public record CategoryNames(Map<Long, String> namesByCategoryId) {

    public String nameOf(Long categoryId) {
        return namesByCategoryId.get(categoryId);
    }
}
