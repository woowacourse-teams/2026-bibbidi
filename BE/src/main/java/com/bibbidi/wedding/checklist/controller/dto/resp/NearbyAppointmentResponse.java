package com.bibbidi.wedding.checklist.controller.dto.resp;

import com.bibbidi.wedding.checklist.service.dto.AppointmentResult;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record NearbyAppointmentResponse(
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

    public static NearbyAppointmentResponse from(AppointmentResult appointment) {
        return new NearbyAppointmentResponse(
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
