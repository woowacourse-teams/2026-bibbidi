package com.bibbidi.wedding.catalog.controller.dto;

import com.bibbidi.wedding.catalog.domain.Item;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Set;

public record ItemResponse(
        @JsonInclude(JsonInclude.Include.NON_NULL) Long id,
        String title,
        int displayOrder,
        boolean essential,
        @JsonInclude(JsonInclude.Include.NON_NULL) Boolean included
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

    public static ItemResponse forPublic(Item item) {
        return new ItemResponse(
                null,
                item.title(),
                item.displayOrder(),
                item.essential(),
                null
        );
    }
}
