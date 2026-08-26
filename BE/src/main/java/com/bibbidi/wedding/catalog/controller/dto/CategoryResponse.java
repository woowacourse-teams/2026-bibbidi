package com.bibbidi.wedding.catalog.controller.dto;

import com.bibbidi.wedding.catalog.service.dto.CategoryResult;
import java.util.List;

public record CategoryResponse(
        Long id,
        String name,
        int displayOrder,
        List<StepResponse> steps
) {

    public static CategoryResponse from(CategoryResult category) {
        return new CategoryResponse(
                category.id(),
                category.name(),
                category.displayOrder(),
                category.steps().stream()
                        .map(StepResponse::from)
                        .toList()
        );
    }
}
