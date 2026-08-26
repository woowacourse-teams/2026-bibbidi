package com.bibbidi.wedding.appointment.service.dto;

import com.bibbidi.wedding.appointment.controller.dto.CreateAppointmentRequest;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record AppointmentCreationCommand(
        Long itemId,
        String title,
        LocalDate date,
        LocalDateTime startTime,
        LocalDateTime endTime,
        String place,
        String memo
) {

    public static AppointmentCreationCommand fromRequest(Long itemId, CreateAppointmentRequest request) {
        return new AppointmentCreationCommand(
                itemId,
                request.title(),
                request.date(),
                request.startTime(),
                request.endTime(),
                request.place(),
                request.memo()
        );
    }
}
