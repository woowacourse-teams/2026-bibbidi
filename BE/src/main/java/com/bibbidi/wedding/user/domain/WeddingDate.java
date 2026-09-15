package com.bibbidi.wedding.user.domain;

import java.time.LocalDate;
import org.jspecify.annotations.NonNull;
import org.jspecify.annotations.Nullable;

public final class WeddingDate {

    private final Long userId;
    private final LocalDate date;

    public WeddingDate(@NonNull Long userId, @Nullable LocalDate date) {
        this.userId = userId;
        this.date = date;
    }

    public WeddingDate changeDate(@NonNull LocalDate date) {
        return new WeddingDate(userId, date);
    }

    public Long userId() {
        return userId;
    }

    public LocalDate date() {
        return date;
    }
}
