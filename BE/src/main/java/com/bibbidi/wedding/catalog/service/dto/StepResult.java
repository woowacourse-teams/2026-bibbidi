package com.bibbidi.wedding.catalog.service.dto;

import com.bibbidi.wedding.catalog.domain.Step;
import java.util.List;
import java.util.Set;

public record StepResult(
        Long id,
        String name,
        String description,
        int displayOrder,
        List<ItemResult> items
) {

    public static StepResult fromDomain(Step step, Set<Long> includedItemIds) {
        return new StepResult(
                step.id(),
                step.name(),
                step.description(),
                step.displayOrder(),
                step.items().stream()
                        .map(item -> ItemResult.fromDomain(item, includedItemIds))
                        .toList()
        );
    }
}
