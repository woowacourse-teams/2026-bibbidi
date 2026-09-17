package com.bibbidi.wedding.checklist.controller.dto.resp;

import com.bibbidi.wedding.checklist.service.dto.AppointmentResult;
import com.bibbidi.wedding.checklist.service.dto.AppointmentConflict;
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

    public static AppointmentResponse from(AppointmentResult appointment) {
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
