package com.bibbidi.wedding.catalog.controller.dto;

import com.bibbidi.wedding.catalog.domain.Item;

public record ItemResponse(
        Long id,
        String title,
        int displayOrder,
        boolean essential
) {

    public static ItemResponse from(Item item) {
        return new ItemResponse(
                item.id(),
                item.title(),
                item.displayOrder(),
                item.essential()
        );
    }
}
