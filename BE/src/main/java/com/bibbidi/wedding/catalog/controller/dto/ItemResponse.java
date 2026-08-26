package com.bibbidi.wedding.catalog.controller.dto;

import com.bibbidi.wedding.catalog.domain.Item;
import java.util.Set;

public record ItemResponse(
        Long id,
        String title,
        int displayOrder,
        boolean essential,
        boolean included
) {

    public static ItemResponse fromDomain(Item item, Set<Long> includedCatalogItemIds) {
        return new ItemResponse(
                item.id(),
                item.title(),
                item.displayOrder(),
                item.essential(),
                includedCatalogItemIds.contains(item.id())
        );
    }
}
