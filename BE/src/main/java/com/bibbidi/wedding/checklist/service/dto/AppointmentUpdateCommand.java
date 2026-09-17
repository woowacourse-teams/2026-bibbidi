package com.bibbidi.wedding.checklist.service.dto;

import com.bibbidi.wedding.checklist.controller.dto.req.UpdateAppointmentRequest;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record AppointmentUpdateCommand(
        Long appointmentId,
        Long userId,
        String title,
        LocalDate date,
        LocalDateTime startTime,
        LocalDateTime endTime,
        String place,
        String memo
) {

    public static AppointmentUpdateCommand fromRequest(
            Long appointmentId,
            Long userId,
            UpdateAppointmentRequest request
    ) {
        return new AppointmentUpdateCommand(
                appointmentId,
                userId,
                request.title(),
                request.date(),
                request.startTime(),
                request.endTime(),
                request.place(),
                request.memo()
        );
    }
}
