package com.bibbidi.wedding.catalog.service.dto;

import com.bibbidi.wedding.catalog.domain.Category;
import java.util.List;
import java.util.Set;

public record CategoryResult(
        Long id,
        String name,
        int displayOrder,
        List<StepResult> steps
) {

    public static CategoryResult fromDomain(Category category, Set<Long> includedItemIds) {
        return new CategoryResult(
                category.id(),
                category.name(),
                category.displayOrder(),
                category.steps().stream()
                        .map(step -> StepResult.fromDomain(step, includedItemIds))
                        .toList()
        );
    }
}
