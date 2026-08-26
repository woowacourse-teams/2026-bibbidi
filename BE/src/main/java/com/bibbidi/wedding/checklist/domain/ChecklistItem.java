package com.bibbidi.wedding.checklist.domain;

public final class ChecklistItem {

    private final Long id;
    private final Long checklistId;
    private final Long categoryId;
    private final String title;
    private final Long sourceCatalogItemId;
    private boolean done;

    private ChecklistItem(
            Long id,
            Long checklistId,
            Long categoryId,
            String title,
            Long sourceCatalogItemId,
            boolean done
    ) {
        this.id = id;
        this.checklistId = checklistId;
        this.categoryId = categoryId;
        this.title = title;
        this.sourceCatalogItemId = sourceCatalogItemId;
        this.done = done;
    }

    static ChecklistItem fromCatalogItem(Long checklistId, CatalogItem catalogItem) {
        return new ChecklistItem(
                null,
                checklistId,
                catalogItem.categoryId(),
                catalogItem.title(),
                catalogItem.id(),
                false
        );
    }

    public static ChecklistItem restore(
            Long id,
            Long checklistId,
            Long categoryId,
            String title,
            Long sourceCatalogItemId,
            boolean done
    ) {
        return new ChecklistItem(id, checklistId, categoryId, title, sourceCatalogItemId, done);
    }

    public void complete() {
        done = true;
    }

    public void reopen() {
        done = false;
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

    public boolean isDone() {
        return done;
    }
}
