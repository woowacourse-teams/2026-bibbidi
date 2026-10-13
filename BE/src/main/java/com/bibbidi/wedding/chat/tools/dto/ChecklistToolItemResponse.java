package com.bibbidi.wedding.chat.tools.dto;

import com.bibbidi.wedding.checklist.service.dto.ChecklistAppointmentResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistItemWithAppointmentsResult;
import java.util.List;

public record ChecklistToolItemResponse(
        Long id,
        Long catalogItemId,
        String title,
        String status,
        List<ChecklistAppointmentResult> appointments
) {

    public static ChecklistToolItemResponse from(ChecklistItemWithAppointmentsResult result) {
        return new ChecklistToolItemResponse(
                result.id(),
                result.sourceCatalogItemId(),
                result.title(),
                result.statusValue(),
                result.appointments()
        );
    }
}
