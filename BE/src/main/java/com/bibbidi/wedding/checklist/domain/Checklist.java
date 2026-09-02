package com.bibbidi.wedding.checklist.domain;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;

public final class Checklist {

    private final Long id;
    private final Long ownerId;
    private final List<ChecklistItem> items;

    public Checklist(@Nullable Long id, Long ownerId, List<ChecklistItem> items) {
        this.id = id;
        this.ownerId = ownerId;
        this.items = List.copyOf(items);
    }

    public ChecklistItem changeItemCategory(Long ownerId, Long checklistItemId, Long categoryId) {
        validateOwnedBy(ownerId);
        ChecklistItem item = findItem(checklistItemId);

        return item.changeCategory(categoryId);
    }

    public ChecklistItem changeItemTitle(Long ownerId, Long checklistItemId, String title) {
        validateOwnedBy(ownerId);
        ChecklistItem item = findItem(checklistItemId);

        return item.changeTitle(title);
    }

    public ChecklistItem changeItemStatus(Long ownerId, Long checklistItemId, ChecklistItemStatus status) {
        validateOwnedBy(ownerId);
        ChecklistItem item = findItem(checklistItemId);

        return item.changeStatus(status);
    }

    public ChecklistItem deletableItem(Long ownerId, Long checklistItemId) {
        validateOwnedBy(ownerId);
        ChecklistItem item = findItem(checklistItemId);
        item.validateDeletable();

        return item;
    }

    public void validateOwnedBy(Long ownerId) {
        if (!this.ownerId.equals(ownerId)) {
            throw new BusinessException(
                    ClientError.CHECKLIST_ITEM_ACCESS_DENIED,
                    "현재 사용자 계정에 속한 체크리스트가 아닙니다. ownerId=" + ownerId
                            + ", checklistId=" + id
            );
        }
    }

    public List<Long> itemIds() {
        return items.stream()
                .map(ChecklistItem::id)
                .toList();
    }

    public Long id() {
        return id;
    }

    public Long ownerId() {
        return ownerId;
    }

    public List<ChecklistItem> items() {
        return items;
    }

    private ChecklistItem findItem(Long checklistItemId) {
        return items.stream()
                .filter(item -> Objects.equals(item.id(), checklistItemId))
                .findFirst()
                .orElseThrow(() -> new BusinessException(
                        ClientError.CHECKLIST_ITEM_NOT_FOUND,
                        "할 일을 찾을 수 없습니다. checklistItemId=" + checklistItemId
                ));
    }
}
