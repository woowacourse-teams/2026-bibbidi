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
    private final String place;
    private final String memo;
    private final boolean isDone;
    private final LocalDateTime startTime;
    private final LocalDateTime endTime;

    public Appointment(
            @Nullable Long id,
            @NonNull Long checklistItemId,
            @NonNull String title,
            @NonNull LocalDate date,
            String place,
            String memo,
            boolean isDone,
            LocalDateTime startTime,
            LocalDateTime endTime
    ) {
        this.id = id;
        this.checklistItemId = checklistItemId;
        this.title = title;
        this.date = date;
        this.place = place;
        this.memo = memo;
        this.isDone = isDone;
        this.startTime = startTime;
        this.endTime = endTime;
    }

    private Appointment update(
            Long checklistItemId,
            String title,
            LocalDate date,
            String place,
            String memo,
            boolean isDone,
            LocalDateTime startTime,
            LocalDateTime endTime
    ) {
        return new Appointment(
                id,
                checklistItemId,
                title,
                date,
                place,
                memo,
                isDone,
                startTime,
                endTime
        );
    }

    public Appointment complete() {
        return update(checklistItemId, title, date, place, memo, true, startTime, endTime);
    }

    public Appointment reopen() {
        return update(checklistItemId, title, date, place, memo, false, startTime, endTime);
    }

    public boolean isFinished() {
        return isDone;
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
