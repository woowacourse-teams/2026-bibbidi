package com.bibbidi.wedding.appointment.domain;

import java.time.LocalDate;
import java.time.LocalDateTime;
import org.jspecify.annotations.NonNull;
import org.jspecify.annotations.Nullable;

public final class Appointment {

    private final Long id;
    private final Long checklistItemId;
    private final String title;
    private final LocalDate date;
    private final LocalDateTime startTime;
    private final LocalDateTime endTime;
    private final String place;
    private final String memo;
    private final boolean isDone;

    public Appointment(
            @Nullable Long id,
            @NonNull Long checklistItemId,
            @NonNull String title,
            @NonNull LocalDate date,
            LocalDateTime startTime,
            LocalDateTime endTime,
            String place,
            String memo,
            boolean isDone
    ) {
        this.id = id;
        this.checklistItemId = checklistItemId;
        this.title = title;
        this.date = date;
        this.startTime = startTime;
        this.endTime = endTime;
        this.place = place;
        this.memo = memo;
        this.isDone = isDone;
    }

    public Appointment complete() {
        return copy(checklistItemId, title, date, startTime, endTime, place, memo, true);
    }

    public Appointment reopen() {
        return copy(checklistItemId, title, date, startTime, endTime, place, memo, false);
    }

    public Appointment update(
            String title,
            LocalDate date,
            LocalDateTime startTime,
            LocalDateTime endTime,
            String place,
            String memo
    ) {
        return copy(checklistItemId, title, date, startTime, endTime, place, memo, isDone);
    }

    private Appointment copy(
            Long checklistItemId,
            String title,
            LocalDate date,
            LocalDateTime startTime,
            LocalDateTime endTime,
            String place,
            String memo,
            boolean isDone
    ) {
        return new Appointment(
                id,
                checklistItemId,
                title,
                date,
                startTime,
                endTime,
                place,
                memo,
                isDone
        );
    }

    public Long id() {
        return id;
    }

    public Long checklistItemId() {
        return checklistItemId;
    }

    public String title() {
        return title;
    }

    public LocalDate date() {
        return date;
    }

    public String place() {
        return place;
    }

    public String memo() {
        return memo;
    }

    public boolean isDone() {
        return isDone;
    }

    public LocalDateTime startTime() {
        return startTime;
    }

    public LocalDateTime endTime() {
        return endTime;
    }

}
