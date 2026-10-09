package com.bibbidi.wedding.chat.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.jspecify.annotations.NonNull;
import org.jspecify.annotations.Nullable;

public record PreparationSnapshot(
        @Nullable LocalDate weddingDate,
        @NonNull List<ChecklistItem> checklistItems,
        @NonNull List<CatalogItem> catalogItems,
        @NonNull Instant queriedAt
) {

    public PreparationSnapshot {
        checklistItems = List.copyOf(checklistItems);
        catalogItems = List.copyOf(catalogItems);
    }

    public boolean hasNoChecklistItems() {
        return checklistItems.isEmpty();
    }

    public boolean hasWeddingDate() {
        return weddingDate != null;
    }

    public List<Long> pastUnconfirmedAppointmentIds(Set<Long> confirmedAppointmentIds, LocalDate today) {
        return checklistItems.stream()
                .flatMap(item -> item.appointments().stream())
                .filter(appointment -> appointment.isIncompleteBefore(today))
                .filter(appointment -> !confirmedAppointmentIds.contains(appointment.id()))
                .map(Appointment::id)
                .toList();
    }

    public List<Long> inProgressChecklistItemIds() {
        return checklistItems.stream()
                .filter(ChecklistItem::isInProgress)
                .map(ChecklistItem::id)
                .toList();
    }

    public List<CatalogItem> recommendationCandidates() {
        Set<Long> registeredIds = checklistItems.stream()
                .map(ChecklistItem::sourceCatalogItemId)
                .filter(id -> id != null)
                .collect(Collectors.toSet());
        return catalogItems.stream().filter(item -> !registeredIds.contains(item.id())).toList();
    }

    public record ChecklistItem(
            @NonNull Long id,
            @Nullable Long categoryId,
            @Nullable Long sourceCatalogItemId,
            @NonNull String title,
            @NonNull Status status,
            @NonNull List<Appointment> appointments
    ) {

        public ChecklistItem {
            appointments = List.copyOf(appointments);
        }

        public boolean isInProgress() {
            return status == Status.CONTINUE;
        }
    }

    public enum Status {
        PREV, CONTINUE, DONE
    }

    public record Appointment(
            @NonNull Long id,
            @NonNull String title,
            @NonNull LocalDate date,
            @Nullable LocalDateTime startTime,
            @Nullable LocalDateTime endTime,
            @Nullable String place,
            @Nullable String memo,
            boolean done
    ) {

        public boolean isIncompleteBefore(LocalDate today) {
            return !done && date.isBefore(today);
        }
    }

    public record CatalogItem(
            @NonNull Long id,
            @NonNull String title,
            @NonNull String categoryName,
            int phase,
            @NonNull String stepName
    ) {
    }
}
