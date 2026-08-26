package com.bibbidi.wedding.catalog.controller.dto;

import com.bibbidi.wedding.catalog.service.dto.ItemResult;

public record ItemResponse(
        Long id,
        String title,
        int displayOrder,
        boolean essential,
        boolean included
) {

    public static ItemResponse from(ItemResult item) {
        return new ItemResponse(
                item.id(),
                item.title(),
                item.displayOrder(),
                item.essential(),
                item.included()
        );
    }
}
