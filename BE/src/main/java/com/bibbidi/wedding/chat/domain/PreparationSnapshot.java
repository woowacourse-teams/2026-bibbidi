package com.bibbidi.wedding.chat.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.jspecify.annotations.NonNull;
import org.jspecify.annotations.Nullable;

public record PreparationSnapshot(
        @Nullable LocalDate weddingDate,
        @NonNull List<PreparationChecklistItem> checklistItems,
        @NonNull List<PreparationCatalogItem> catalogItems,
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
                .map(PreparationAppointment::id)
                .toList();
    }

    public List<Long> inProgressChecklistItemIds() {
        return checklistItems.stream()
                .filter(PreparationChecklistItem::isInProgress)
                .map(PreparationChecklistItem::id)
                .toList();
    }

    public List<PreparationCatalogItem> recommendationCandidates() {
        Set<Long> registeredIds = checklistItems.stream()
                .map(PreparationChecklistItem::sourceCatalogItemId)
                .filter(id -> id != null)
                .collect(Collectors.toSet());
        return catalogItems.stream().filter(item -> !registeredIds.contains(item.id())).toList();
    }
}
