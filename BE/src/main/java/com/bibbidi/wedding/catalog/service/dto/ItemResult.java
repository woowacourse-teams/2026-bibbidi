package com.bibbidi.wedding.catalog.service.dto;

import com.bibbidi.wedding.catalog.domain.Item;
import java.util.Set;

public record ItemResult(
        Long id,
        String title,
        int displayOrder,
        boolean essential,
        boolean included
) {

    public static ItemResult fromDomain(Item item, Set<Long> includedItemIds) {
        return new ItemResult(
                item.id(),
                item.title(),
                item.displayOrder(),
                item.essential(),
                includedItemIds.contains(item.id())
        );
    }
}
