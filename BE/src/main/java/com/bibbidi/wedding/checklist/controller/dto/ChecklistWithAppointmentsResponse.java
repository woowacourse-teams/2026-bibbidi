package com.bibbidi.wedding.checklist.controller.dto;

import com.bibbidi.wedding.checklist.service.dto.ChecklistAppointmentResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistItemWithAppointmentsResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistWithAppointmentsResult;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record ChecklistWithAppointmentsResponse(
        Long id,
        List<ChecklistItemWithAppointmentsResponse> items
) {

    public static ChecklistWithAppointmentsResponse from(ChecklistWithAppointmentsResult result) {
        return new ChecklistWithAppointmentsResponse(
                result.id(),
                result.items().stream().map(ChecklistItemWithAppointmentsResponse::from).toList()
        );
    }

    public record ChecklistItemWithAppointmentsResponse(
            Long id,
            Long categoryId,
            Long sourceCatalogItemId,
            String title,
            boolean isDone,
            List<AppointmentSummaryResponse> appointments
    ) {
        private static ChecklistItemWithAppointmentsResponse from(ChecklistItemWithAppointmentsResult result) {
            return new ChecklistItemWithAppointmentsResponse(
                    result.id(), result.categoryId(), result.sourceCatalogItemId(), result.title(),
                    result.isDone(), result.appointments().stream().map(AppointmentSummaryResponse::from).toList()
            );
        }
    }

    public record AppointmentSummaryResponse(
            Long id,
            String title,
            LocalDate date,
            LocalDateTime startTime,
            LocalDateTime endTime,
            String place,
            String memo,
            boolean isDone
    ) {
        private static AppointmentSummaryResponse from(ChecklistAppointmentResult result) {
            return new AppointmentSummaryResponse(
                    result.id(), result.title(), result.date(), result.startTime(), result.endTime(),
                    result.place(), result.memo(), result.isDone()
            );
        }
    }
}
