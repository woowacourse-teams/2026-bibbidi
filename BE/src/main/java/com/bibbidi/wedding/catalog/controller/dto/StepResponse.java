package com.bibbidi.wedding.catalog.controller.dto;

import com.bibbidi.wedding.catalog.domain.Step;
import java.util.List;

public record StepResponse(
        Long id,
        String name,
        String description,
        String iconUrl,
        int displayOrder,
        List<ItemResponse> items
) {

    public static StepResponse forPublic(Step step) {
        return new StepResponse(
                step.id(),
                step.name(),
                step.description(),
                step.iconUrl(),
                step.displayOrder(),
                step.items().stream()
                        .map(ItemResponse::forPublic)
                        .toList()
        );
    }
}
