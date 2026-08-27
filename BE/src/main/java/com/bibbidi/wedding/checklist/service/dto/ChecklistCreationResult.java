package com.bibbidi.wedding.checklist.service.dto;

import com.bibbidi.wedding.checklist.domain.Checklist;

public record ChecklistCreationResult(Long id) {

    public static ChecklistCreationResult from(Checklist checklist) {
        return new ChecklistCreationResult(checklist.id());
    }
}
