package com.bibbidi.wedding.checklist.domain;

import java.util.Objects;
import java.util.UUID;

public final class Checklist {

    private final Long id;
    private final UUID ownerId;

    private Checklist(Long id, UUID ownerId) {
        this.id = id;
        this.ownerId = Objects.requireNonNull(ownerId);
    }

    public static Checklist createFor(UUID ownerId) {
        return new Checklist(null, ownerId);
    }

    public static Checklist restore(Long id, UUID ownerId) {
        return new Checklist(Objects.requireNonNull(id), ownerId);
    }

    public Long id() {
        return id;
    }

    public UUID ownerId() {
        return ownerId;
    }
}
