package com.bibbidi.wedding.catalog.controller.dto;

import com.bibbidi.wedding.catalog.domain.Category;
import java.util.List;

public record PublicCategoryResponse(
        String name,
        int displayOrder,
        List<PublicStepResponse> steps
) {

    public static PublicCategoryResponse fromDomain(Category category) {
        return new PublicCategoryResponse(
                category.name(),
                category.displayOrder(),
                category.steps().stream()
                        .map(PublicStepResponse::fromDomain)
                        .toList()
        );
    }
}
