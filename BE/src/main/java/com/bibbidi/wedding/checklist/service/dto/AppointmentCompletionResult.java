package com.bibbidi.wedding.checklist.service.dto;

import com.bibbidi.wedding.checklist.domain.Appointment;

public record AppointmentCompletionResult(
        Long id,
        boolean isDone,
        Long checklistItemId,
        boolean checklistItemDone
) {

    public static AppointmentCompletionResult from(Appointment appointment, boolean checklistItemDone) {
        return new AppointmentCompletionResult(
                appointment.id(),
                appointment.isDone(),
                appointment.checklistItemId(),
                checklistItemDone
        );
    }
}
