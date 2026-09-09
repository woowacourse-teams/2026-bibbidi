package com.bibbidi.wedding.checklist.service.dto;

import com.bibbidi.wedding.checklist.domain.Appointment;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record AppointmentSummaryResult(
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

    public static AppointmentSummaryResult from(Appointment appointment) {
        return new AppointmentSummaryResult(
                appointment.id(), appointment.checklistItemId(), appointment.title(), appointment.date(),
                appointment.startTime(), appointment.endTime(), appointment.place(), appointment.memo(),
                appointment.isDone()
        );
    }
}
