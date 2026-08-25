package com.bibbidi.wedding.checklist.domain;

import java.util.Objects;

public final class Checklist {

    private final Long id;
    private final Long ownerId;

    private Checklist(Long id, Long ownerId) {
        this.id = id;
        this.ownerId = Objects.requireNonNull(ownerId);
    }

    public static Checklist createFor(Long ownerId) {
        return new Checklist(null, ownerId);
    }

    public static Checklist restore(Long id, Long ownerId) {
        return new Checklist(Objects.requireNonNull(id), ownerId);
    }

    public Long id() {
        return id;
    }

    public Long ownerId() {
        return ownerId;
    }
}
