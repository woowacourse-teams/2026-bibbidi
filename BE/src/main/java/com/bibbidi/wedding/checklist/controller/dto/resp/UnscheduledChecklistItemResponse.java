package com.bibbidi.wedding.checklist.controller.dto.resp;

import com.bibbidi.wedding.checklist.service.dto.UnscheduledChecklistItemResult;

public record UnscheduledChecklistItemResponse(
        Long checklistItemId,
        String title,
        String categoryName,
        String status
) {

    public static UnscheduledChecklistItemResponse from(UnscheduledChecklistItemResult result) {
        return new UnscheduledChecklistItemResponse(
                result.checklistItemId(),
                result.title(),
                result.categoryName(),
                result.status().value()
        );
    }
}
