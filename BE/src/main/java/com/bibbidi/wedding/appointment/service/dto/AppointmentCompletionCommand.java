package com.bibbidi.wedding.appointment.service.dto;

public record AppointmentCompletionCommand(
        Long appointmentId,
        Long userId,
        boolean isDone
) {

    public static AppointmentCompletionCommand fromRequest(
            Long appointmentId,
            Long userId,
            boolean isDone
    ) {
        return new AppointmentCompletionCommand(
                appointmentId,
                userId,
                isDone
        );
    }
}
