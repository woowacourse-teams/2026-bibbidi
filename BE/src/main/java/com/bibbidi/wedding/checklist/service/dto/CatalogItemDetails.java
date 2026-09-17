package com.bibbidi.wedding.checklist.service.dto;

import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.checklist.domain.Checklist;
import java.util.List;

public record CatalogItemDetails(List<CatalogItemDetailSnapshot> values) {

    public CatalogItemDetails selectIn(Checklist checklist) {
        return new CatalogItemDetails(values.stream()
                .filter(item -> checklist.hasAdded(item.id()))
                .toList());
    }

    public CatalogItemDetails selectNotIn(Checklist checklist) {
        return new CatalogItemDetails(values.stream()
                .filter(item -> !checklist.hasAdded(item.id()))
                .toList());
    }

    public int findLastPhase() {
        return values.stream()
                .mapToInt(CatalogItemDetailSnapshot::phase)
                .max()
                .orElseThrow();
    }

    public CatalogItemDetails recommendBasedOn(int currentPhase) {
        CatalogItemDetails itemsUpToCurrentPhase = selectUpTo(currentPhase);
        if (itemsUpToCurrentPhase.isEmpty()) {
            return selectEarliestPhase();
        }
        return itemsUpToCurrentPhase;
    }

    public boolean isEmpty() {
        return values.isEmpty();
    }

    private CatalogItemDetails selectUpTo(int phase) {
        return new CatalogItemDetails(values.stream()
                .filter(item -> item.isUpTo(phase))
                .toList());
    }

    private CatalogItemDetails selectEarliestPhase() {
        if (isEmpty()) {
            return this;
        }
        int earliestPhase = values.stream()
                .mapToInt(CatalogItemDetailSnapshot::phase)
                .min()
                .orElseThrow();
        return selectUpTo(earliestPhase);
    }
}
