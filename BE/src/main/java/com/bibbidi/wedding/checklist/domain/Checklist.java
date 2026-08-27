package com.bibbidi.wedding.checklist.domain;

import org.jspecify.annotations.Nullable;

public final class Checklist {

    private final Long id;
    private final Long ownerId;

    public Checklist(@Nullable Long id, Long ownerId) {
        this.id = id;
        this.ownerId = ownerId;
    }

    public Long id() {
        return id;
    }

    public Long ownerId() {
        return ownerId;
    }
}
