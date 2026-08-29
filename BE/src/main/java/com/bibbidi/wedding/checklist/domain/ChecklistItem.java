package com.bibbidi.wedding.checklist.domain;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import org.jspecify.annotations.NonNull;
import org.jspecify.annotations.Nullable;

public final class ChecklistItem {

    private final Long id;
    private final Checklist checklist;
    private final Long categoryId;
    private final String title;
    private final Long sourceCatalogItemId;
    private final ChecklistItemStatus status;

    public ChecklistItem(
            @Nullable Long id,
            @NonNull Checklist checklist,
            @Nullable Long categoryId,
            @NonNull String title,
            @Nullable Long sourceCatalogItemId,
            @NonNull ChecklistItemStatus status
    ) {
        this.id = id;
        this.checklist = checklist;
        this.categoryId = categoryId;
        this.title = title;
        this.sourceCatalogItemId = sourceCatalogItemId;
        this.status = status;
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

    public ChecklistItem changeCategory(Long categoryId) {
        if (hasSourceCatalogItem()) {
            throw new BusinessException(
                    ClientError.CHECKLIST_ITEM_CATEGORY_NOT_CHANGEABLE,
                    "준비 목록에서 추가한 할 일입니다. checklistItemId=" + id
                            + ", sourceCatalogItemId=" + sourceCatalogItemId
            );
        }
        return new ChecklistItem(
                id,
                checklist,
                categoryId,
                title,
                sourceCatalogItemId,
                status
        );
    }

    public ChecklistItem changeTitle(String title) {
        if (hasSourceCatalogItem()) {
            throw new BusinessException(
                    ClientError.CHECKLIST_ITEM_TITLE_NOT_CHANGEABLE,
                    "준비 목록에서 추가한 할 일입니다. checklistItemId=" + id
                            + ", sourceCatalogItemId=" + sourceCatalogItemId
            );
        }
        return new ChecklistItem(
                id,
                checklist,
                categoryId,
                title,
                sourceCatalogItemId,
                status
        );
    }

    private ChecklistItem withStatus(ChecklistItemStatus status) {
        return new ChecklistItem(
                id,
                checklist,
                categoryId,
                title,
                sourceCatalogItemId,
                status
        );
    }

    public boolean isOwnedBy(Long ownerId) {
        return checklist.isOwnedBy(ownerId);
    }

    public boolean cameFrom(Long catalogItemId) {
        return catalogItemId != null && catalogItemId.equals(sourceCatalogItemId);
    }

    private boolean hasSourceCatalogItem() {
        return sourceCatalogItemId != null;
    }

    public Long id() {
        return id;
    }

    public Checklist checklist() {
        return checklist;
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
