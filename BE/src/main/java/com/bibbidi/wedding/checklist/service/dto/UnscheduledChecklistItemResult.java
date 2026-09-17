package com.bibbidi.wedding.checklist.service.dto;

import com.bibbidi.wedding.checklist.domain.ChecklistItem;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;

public record UnscheduledChecklistItemResult(
        Long checklistItemId,
        String title,
        String categoryName,
        ChecklistItemStatus status
) {

    public static UnscheduledChecklistItemResult from(ChecklistItem item, String categoryName) {
        return new UnscheduledChecklistItemResult(
                item.id(),
                item.title(),
                categoryName,
                item.status()
        );
    }
}
