package com.bibbidi.wedding.appointment.controller.dto;

import com.bibbidi.wedding.appointment.service.dto.AppointmentCreationResult;
import com.bibbidi.wedding.appointment.service.dto.AppointmentUpdateResult;
import com.bibbidi.wedding.appointment.service.dto.AppointmentConflict;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record AppointmentResponse(
        Long id,
        Long checklistItemId,
        String title,
        LocalDate date,
        LocalDateTime startTime,
        LocalDateTime endTime,
        String place,
        String memo,
        boolean isDone,
        List<AppointmentConflict> conflicts
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
                appointment.isDone(),
                appointment.conflicts()
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
                appointment.isDone(),
                appointment.conflicts()
        );
    }

}
