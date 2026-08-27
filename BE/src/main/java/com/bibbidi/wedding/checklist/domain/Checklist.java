package com.bibbidi.wedding.checklist.domain;

import org.jspecify.annotations.Nullable;

public final class Checklist {

    private final Long id;
    private final Long ownerId;

    public Checklist(@Nullable Long id, Long ownerId) {
        this.id = id;
        this.ownerId = ownerId;
    }

    public ChecklistItem take(Long categoryId, String title, Long catalogItemId) {
        return new ChecklistItem(
                null,
                id,
                categoryId,
                title,
                catalogItemId,
                ChecklistItemStatus.PREV
        );
    }

    public Long id() {
        return id;
    }

    public Long ownerId() {
        return ownerId;
    }
}
