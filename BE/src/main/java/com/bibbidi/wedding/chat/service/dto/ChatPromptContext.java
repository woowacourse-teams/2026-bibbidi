package com.bibbidi.wedding.chat.service.dto;

import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import java.util.List;
import java.util.Set;

public record ChatPromptContext(
        ChecklistSnapshot checklist,
        List<CatalogItemDetailSnapshot> catalog,
        Set<Long> recommendableItemIds
) {
    public ChatPromptContext {
        catalog = List.copyOf(catalog);
        recommendableItemIds = Set.copyOf(recommendableItemIds);
    }
}
