package com.bibbidi.wedding.appointment.controller.dto;

import com.bibbidi.wedding.appointment.service.dto.AppointmentCompletionResult;

public record AppointmentCompletionResponse(
        Long id,
        boolean isDone,
        Long checklistItemId,
        boolean checklistItemDone
) {

    public static AppointmentCompletionResponse from(AppointmentCompletionResult result) {
        return new AppointmentCompletionResponse(
                result.id(),
                result.isDone(),
                result.checklistItemId(),
                result.checklistItemDone()
        );
    }
}
