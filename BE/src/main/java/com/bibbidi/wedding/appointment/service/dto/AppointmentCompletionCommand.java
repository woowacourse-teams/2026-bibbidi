package com.bibbidi.wedding.appointment.service.dto;

import com.bibbidi.wedding.appointment.controller.dto.ChangeAppointmentCompletionRequest;

public record AppointmentCompletionCommand(
        Long appointmentId,
        Long userId,
        boolean isDone
) {

    public static AppointmentCompletionCommand fromRequest(
            Long appointmentId,
            Long userId,
            ChangeAppointmentCompletionRequest request
    ) {
        return new AppointmentCompletionCommand(
                appointmentId,
                userId,
                request.isDone()
        );
    }
}
