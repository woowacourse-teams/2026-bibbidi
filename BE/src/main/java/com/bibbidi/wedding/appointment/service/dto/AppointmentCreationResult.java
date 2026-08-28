package com.bibbidi.wedding.appointment.service.dto;

import com.bibbidi.wedding.appointment.domain.Appointment;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record AppointmentCreationResult(
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
    public AppointmentCreationResult(
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
        this(
                id,
                checklistItemId,
                title,
                date,
                startTime,
                endTime,
                place,
                memo,
                isDone,
                List.of()
        );

    }

    public static AppointmentCreationResult fromDomain(Appointment appointment) {
        return new AppointmentCreationResult(
                appointment.id(),
                appointment.checklistItemId(),
                appointment.title(),
                appointment.date(),
                appointment.startTime(),
                appointment.endTime(),
                appointment.place(),
                appointment.memo(),
                appointment.isDone(),
                List.of()
        );
    }

    public AppointmentCreationResult withConflicts(List<AppointmentConflict> conflicts) {
        return new AppointmentCreationResult(
                id,
                checklistItemId,
                title,
                date,
                startTime,
                endTime,
                place,
                memo,
                isDone,
                conflicts
        );
    }
}
