package com.bibbidi.wedding.checklist.service;

import java.util.List;

public record ChecklistDeletionTarget(
        Long checklistId,
        List<Long> checklistItemIds
) {
}
