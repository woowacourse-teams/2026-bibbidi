package com.bibbidi.wedding.catalog.controller.dto;

import com.bibbidi.wedding.catalog.domain.Category;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.util.Set;

public record CategoryResponse(
        @JsonInclude(JsonInclude.Include.NON_NULL) Long id,
        String name,
        int displayOrder,
        List<StepResponse> steps
) {

    public static CategoryResponse fromDomain(Category category, Set<Long> includedCatalogItemIds) {
        return new CategoryResponse(
                category.id(),
                category.name(),
                category.displayOrder(),
                category.steps().stream()
                        .map(step -> StepResponse.fromDomain(step, includedCatalogItemIds))
                        .toList()
        );
    }

    public static CategoryResponse forPublic(Category category) {
        return new CategoryResponse(
                null,
                category.name(),
                category.displayOrder(),
                category.steps().stream()
                        .map(StepResponse::forPublic)
                        .toList()
        );
    }
}
