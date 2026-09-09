package com.bibbidi.wedding.checklist.service.dto;

import com.bibbidi.wedding.checklist.domain.Appointment;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record AppointmentConflict(
        Long appointmentId,
        Long checklistItemId,
        String title,
        LocalDate date,
        LocalDateTime startTime,
        LocalDateTime endTime,
        String place
) {

    public static AppointmentConflict fromDomain(Appointment appointment) {
        return new AppointmentConflict(
                appointment.id(),
                appointment.checklistItemId(),
                appointment.title(),
                appointment.date(),
                appointment.startTime(),
                appointment.endTime(),
                appointment.place()
        );
    }
}
