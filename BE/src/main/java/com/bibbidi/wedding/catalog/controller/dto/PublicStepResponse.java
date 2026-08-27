package com.bibbidi.wedding.catalog.controller.dto;

import com.bibbidi.wedding.catalog.domain.Step;
import java.util.List;

public record PublicStepResponse(
        String name,
        String description,
        int displayOrder,
        List<PublicItemResponse> items
) {

    public static PublicStepResponse fromDomain(Step step) {
        return new PublicStepResponse(
                step.name(),
                step.description(),
                step.displayOrder(),
                step.items().stream()
                        .map(PublicItemResponse::fromDomain)
                        .toList()
        );
    }
}
