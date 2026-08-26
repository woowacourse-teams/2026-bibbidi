package com.bibbidi.wedding.checklist.domain;

public final class CatalogItem {

    private final Long id;
    private final Long categoryId;
    private final String title;
    private final String description;

    private CatalogItem(Long id, Long categoryId, String title, String description) {
        this.id = id;
        this.categoryId = categoryId;
        this.title = title;
        this.description = description;
    }

    public static CatalogItem create(Long categoryId, String title, String description) {
        return new CatalogItem(null, categoryId, title, description);
    }

    public static CatalogItem restore(
            Long id,
            Long categoryId,
            String title,
            String description
    ) {
        return new CatalogItem(id, categoryId, title, description);
    }

    public ChecklistItem toChecklistItem(Long checklistId) {
        return ChecklistItem.fromCatalogItem(checklistId, this);
    }

    public Long id() {
        return id;
    }

    public Long categoryId() {
        return categoryId;
    }

    public String title() {
        return title;
    }

    public String description() {
        return description;
    }
}
