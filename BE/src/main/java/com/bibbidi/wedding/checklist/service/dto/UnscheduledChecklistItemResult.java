package com.bibbidi.wedding.checklist.service.dto;

import com.bibbidi.wedding.checklist.domain.ChecklistItem;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import java.util.Map;

public record UnscheduledChecklistItemResult(
        Long checklistItemId,
        String title,
        String categoryName,
        ChecklistItemStatus status
) {

    public static UnscheduledChecklistItemResult from(ChecklistItem item, Map<Long, String> categoryNames) {
        return new UnscheduledChecklistItemResult(
                item.id(),
                item.title(),
                item.categoryId() == null ? null : categoryNames.get(item.categoryId()),
                item.status()
        );
    }
}
