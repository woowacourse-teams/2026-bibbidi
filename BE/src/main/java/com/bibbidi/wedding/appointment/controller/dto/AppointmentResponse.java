package com.bibbidi.wedding.appointment.controller.dto;

import com.bibbidi.wedding.appointment.service.AppointmentCreationResult;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record AppointmentResponse(
        Long id,
        Long checklistItemId,
        String title,
        LocalDate date,
        String place,
        String memo,
        boolean isDone,
        LocalDateTime startTime,
        LocalDateTime endTime
) {

    public static AppointmentResponse from(AppointmentCreationResult appointment) {
        return new AppointmentResponse(
                appointment.id(),
                appointment.checklistItemId(),
                appointment.title(),
                appointment.date(),
                appointment.place(),
                appointment.memo(),
                appointment.isDone(),
                appointment.startTime(),
                appointment.endTime()
        );
    }
}
