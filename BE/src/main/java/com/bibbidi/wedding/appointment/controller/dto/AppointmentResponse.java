package com.bibbidi.wedding.appointment.controller.dto;

import com.bibbidi.wedding.appointment.service.dto.AppointmentCreationResult;
import com.bibbidi.wedding.appointment.service.dto.AppointmentUpdateResult;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record AppointmentResponse(
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

    public static AppointmentResponse from(AppointmentCreationResult appointment) {
        return new AppointmentResponse(
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

    public static AppointmentResponse from(AppointmentUpdateResult appointment) {
        return new AppointmentResponse(
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
