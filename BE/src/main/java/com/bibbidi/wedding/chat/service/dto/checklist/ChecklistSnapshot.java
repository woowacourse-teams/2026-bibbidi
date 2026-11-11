package com.bibbidi.wedding.chat.service.dto.checklist;

import com.bibbidi.wedding.checklist.service.dto.ChecklistWithAppointmentsResult;
import java.util.List;
import java.util.Optional;

public record ChecklistSnapshot(
        boolean exists,
        List<ChecklistItemSnapshot> items
) {

    public static ChecklistSnapshot from(ChecklistWithAppointmentsResult result) {
        return new ChecklistSnapshot(true, result.items().stream().map(ChecklistItemSnapshot::from).toList());
    }

    public static ChecklistSnapshot of(Optional<ChecklistWithAppointmentsResult> result) {
        return result.map(ChecklistSnapshot::from).orElseGet(ChecklistSnapshot::notFound);
    }

    public static ChecklistSnapshot notFound() {
        return new ChecklistSnapshot(false, List.of());
    }
}
