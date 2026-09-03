package com.bibbidi.wedding.checklist.service.dto;

import com.bibbidi.wedding.appointment.domain.Appointment;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record ChecklistAppointmentResult(
        Long id,
        String title,
        LocalDate date,
        LocalDateTime startTime,
        LocalDateTime endTime,
        String place,
        String memo,
        boolean isDone
) {

    public static ChecklistAppointmentResult from(Appointment appointment) {
        return new ChecklistAppointmentResult(
                appointment.id(), appointment.title(), appointment.date(), appointment.startTime(),
                appointment.endTime(), appointment.place(), appointment.memo(), appointment.isDone()
        );
    }
}
