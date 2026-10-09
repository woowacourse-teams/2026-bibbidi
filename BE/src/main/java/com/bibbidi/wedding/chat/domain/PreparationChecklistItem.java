package com.bibbidi.wedding.chat.domain;

import java.util.List;
import org.jspecify.annotations.NonNull;
import org.jspecify.annotations.Nullable;

public record PreparationChecklistItem(
        @NonNull Long id,
        @Nullable Long categoryId,
        @Nullable Long sourceCatalogItemId,
        @NonNull String title,
        @NonNull PreparationChecklistItemStatus status,
        @NonNull List<PreparationAppointment> appointments
) {

    public PreparationChecklistItem {
        appointments = List.copyOf(appointments);
    }

    public boolean isInProgress() {
        return status == PreparationChecklistItemStatus.CONTINUE;
    }
}
