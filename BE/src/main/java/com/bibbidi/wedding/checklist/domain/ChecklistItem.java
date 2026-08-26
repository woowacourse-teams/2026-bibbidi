package com.bibbidi.wedding.checklist.domain;

import org.jspecify.annotations.Nullable;

public final class ChecklistItem {

    private final Long id;
    private final Long checklistId;
    private final Long categoryId;
    private final String title;
    private final Long sourceCatalogItemId;
    private final ChecklistItemStatus status;

    public ChecklistItem(
            @Nullable Long id,
            Long checklistId,
            Long categoryId,
            String title,
            Long sourceCatalogItemId,
            ChecklistItemStatus status
    ) {
        this.id = id;
        this.checklistId = checklistId;
        this.categoryId = categoryId;
        this.title = title;
        this.sourceCatalogItemId = sourceCatalogItemId;
        this.status = status;
    }

    public ChecklistItem(Long checklistId, CatalogItem catalogItem) {
        this.id = null;
        this.checklistId = checklistId;
        this.categoryId = catalogItem.categoryId();
        this.title = catalogItem.title();
        this.sourceCatalogItemId = catalogItem.id();
        this.status = ChecklistItemStatus.PREV;
    }

    public ChecklistItem onProgress() {
        return withStatus(ChecklistItemStatus.CONTINUE);
    }

    public ChecklistItem complete() {
        return withStatus(ChecklistItemStatus.DONE);
    }

    public ChecklistItem reset() {
        return withStatus(ChecklistItemStatus.PREV);
    }

    private ChecklistItem withStatus(ChecklistItemStatus status) {
        return new ChecklistItem(
                id,
                checklistId,
                categoryId,
                title,
                sourceCatalogItemId,
                status
        );
    }

    public boolean cameFrom(Long catalogItemId) {
        return catalogItemId != null && catalogItemId.equals(sourceCatalogItemId);
    }

    public Long id() {
        return id;
    }

    public Long checklistId() {
        return checklistId;
    }

    public Long categoryId() {
        return categoryId;
    }

    public String title() {
        return title;
    }

    public Long sourceCatalogItemId() {
        return sourceCatalogItemId;
    }

    public ChecklistItemStatus status() {
        return status;
    }

    public boolean isDone() {
        return status == ChecklistItemStatus.DONE;
    }
}
