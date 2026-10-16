package com.bibbidi.wedding.chat.service.dto.prompt;

import com.bibbidi.wedding.checklist.service.dto.ChecklistAppointmentResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistItemWithAppointmentsResult;
import java.util.List;
import org.jspecify.annotations.Nullable;

public record ChecklistItemSnapshot(
        Long id,
        @Nullable Long catalogItemId,
        String title,
        String status,
        List<ChecklistAppointmentResult> appointments
) {

    public static ChecklistItemSnapshot from(ChecklistItemWithAppointmentsResult result) {
        return new ChecklistItemSnapshot(result.id(), result.sourceCatalogItemId(), result.title(),
                result.statusValue(), result.appointments());
    }
}
