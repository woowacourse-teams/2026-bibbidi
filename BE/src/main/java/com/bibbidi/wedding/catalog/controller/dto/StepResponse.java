package com.bibbidi.wedding.catalog.controller.dto;

import com.bibbidi.wedding.catalog.service.dto.StepResult;
import java.util.List;

public record StepResponse(
        Long id,
        String name,
        String description,
        int displayOrder,
        List<ItemResponse> items
) {

    public static StepResponse from(StepResult step) {
        return new StepResponse(
                step.id(),
                step.name(),
                step.description(),
                step.displayOrder(),
                step.items().stream()
                        .map(ItemResponse::from)
                        .toList()
        );
    }
}
