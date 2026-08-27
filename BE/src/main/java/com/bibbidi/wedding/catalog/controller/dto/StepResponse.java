package com.bibbidi.wedding.catalog.controller.dto;

import com.bibbidi.wedding.catalog.domain.Step;
import java.util.List;
import java.util.Set;

public record StepResponse(
        Long id,
        String name,
        String description,
        int displayOrder,
        List<ItemResponse> items
) {

    public static StepResponse fromDomain(Step step, Set<Long> includedCatalogItemIds) {
        return new StepResponse(
                step.id(),
                step.name(),
                step.description(),
                step.displayOrder(),
                step.items().stream()
                        .map(item -> ItemResponse.fromDomain(item, includedCatalogItemIds))
                        .toList()
        );
    }

    public static StepResponse forPublic(Step step) {
        return new StepResponse(
                step.id(),
                step.name(),
                step.description(),
                step.displayOrder(),
                step.items().stream()
                        .map(ItemResponse::forPublic)
                        .toList()
        );
    }
}
