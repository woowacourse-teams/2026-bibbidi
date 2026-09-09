package com.bibbidi.wedding.checklist.service.dto;

import com.bibbidi.wedding.checklist.controller.dto.req.CreateAppointmentRequest;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record AppointmentCreationCommand(
        Long userId,
        Long checklistItemId,
        String title,
        LocalDate date,
        LocalDateTime startTime,
        LocalDateTime endTime,
        String place,
        String memo
) {

    public static AppointmentCreationCommand fromRequest(Long userId, Long itemId, CreateAppointmentRequest request) {
        return new AppointmentCreationCommand(
                userId,
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
