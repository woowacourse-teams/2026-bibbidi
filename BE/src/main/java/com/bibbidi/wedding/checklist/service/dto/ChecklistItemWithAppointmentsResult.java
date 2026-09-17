package com.bibbidi.wedding.checklist.service.dto;

import com.bibbidi.wedding.checklist.domain.ChecklistItem;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import java.util.List;

public record ChecklistItemWithAppointmentsResult(
        Long id,
        Long categoryId,
        Long sourceCatalogItemId,
        String title,
        ChecklistItemStatus status,
        List<ChecklistAppointmentResult> appointments
) {

    public static ChecklistItemWithAppointmentsResult from(ChecklistItem item, List<AppointmentSummaryResult> appointments) {
        return new ChecklistItemWithAppointmentsResult(
                item.id(),
                item.categoryId(),
                item.sourceCatalogItemId(),
                item.title(),
                item.status(),
                appointments.stream().map(ChecklistAppointmentResult::from).toList()
        );
    }
}
