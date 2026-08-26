package com.bibbidi.wedding.appointment.service;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record AppointmentCreationResult(
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
}
