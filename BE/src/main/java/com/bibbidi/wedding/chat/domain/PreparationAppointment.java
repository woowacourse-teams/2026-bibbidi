package com.bibbidi.wedding.chat.domain;

import java.time.LocalDate;
import java.time.LocalDateTime;
import org.jspecify.annotations.NonNull;
import org.jspecify.annotations.Nullable;

public record PreparationAppointment(
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
