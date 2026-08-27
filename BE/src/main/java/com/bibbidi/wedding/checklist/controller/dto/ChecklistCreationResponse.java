package com.bibbidi.wedding.checklist.controller.dto;

import com.bibbidi.wedding.checklist.service.dto.ChecklistCreationResult;

public record ChecklistCreationResponse(Long id) {

    public static ChecklistCreationResponse from(ChecklistCreationResult result) {
        return new ChecklistCreationResponse(result.id());
    }
}
