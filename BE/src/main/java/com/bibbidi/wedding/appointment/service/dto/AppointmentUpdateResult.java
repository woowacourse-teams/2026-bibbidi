package com.bibbidi.wedding.appointment.service.dto;

import com.bibbidi.wedding.appointment.domain.Appointment;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record AppointmentUpdateResult(
        Long id,
        Long checklistItemId,
        String title,
        LocalDate date,
        LocalDateTime startTime,
        LocalDateTime endTime,
        String place,
        String memo,
        boolean isDone
) {

    public static AppointmentUpdateResult fromDomain(Appointment appointment) {
        return new AppointmentUpdateResult(
                appointment.id(),
                appointment.checklistItemId(),
                appointment.title(),
                appointment.date(),
                appointment.startTime(),
                appointment.endTime(),
                appointment.place(),
                appointment.memo(),
                appointment.isDone()
        );
    }
}
