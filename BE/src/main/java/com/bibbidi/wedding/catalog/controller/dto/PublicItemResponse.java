package com.bibbidi.wedding.catalog.controller.dto;

import com.bibbidi.wedding.catalog.domain.Item;

public record PublicItemResponse(
        String title,
        int displayOrder,
        boolean essential
) {

    public static PublicItemResponse fromDomain(Item item) {
        return new PublicItemResponse(
                item.title(),
                item.displayOrder(),
                item.essential()
        );
    }
}
