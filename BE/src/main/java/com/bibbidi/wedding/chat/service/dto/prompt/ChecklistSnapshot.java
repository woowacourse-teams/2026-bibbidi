package com.bibbidi.wedding.chat.service.dto.prompt;

import com.bibbidi.wedding.checklist.service.dto.ChecklistWithAppointmentsResult;
import java.util.List;

public record ChecklistSnapshot(
        boolean exists,
        List<ChecklistItemSnapshot> items
) {

    public static ChecklistSnapshot from(ChecklistWithAppointmentsResult result) {
        return new ChecklistSnapshot(true, result.items().stream().map(ChecklistItemSnapshot::from).toList());
    }

    public static ChecklistSnapshot notFound() {
        return new ChecklistSnapshot(false, List.of());
    }
}
