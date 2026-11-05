package com.bibbidi.wedding.chat.service.dto.prompt;

import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import java.util.List;
import java.util.Set;

public record BibbidiCustomChatPromptContext(
        ChecklistSnapshot checklist,
        List<CatalogItemDetailSnapshot> catalog,
        Set<Long> recommendableItemIds
) {
    public BibbidiCustomChatPromptContext {
        catalog = List.copyOf(catalog);
        recommendableItemIds = Set.copyOf(recommendableItemIds);
    }
}
