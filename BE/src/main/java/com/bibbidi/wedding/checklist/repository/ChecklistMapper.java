package com.bibbidi.wedding.checklist.repository;

import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.domain.ChecklistItem;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemEntity;
import org.springframework.stereotype.Component;

@Component
public class ChecklistMapper {

    public JpaChecklistEntity toEntity(Checklist checklist) {
        return new JpaChecklistEntity(
                checklist.id(),
                checklist.ownerId()
        );
    }

    public Checklist toDomain(JpaChecklistEntity entity) {
        return new Checklist(
                entity.id(),
                entity.ownerId()
        );
    }

    public JpaChecklistItemEntity toEntity(ChecklistItem checklistItem) {
        return new JpaChecklistItemEntity(
                checklistItem.id(),
                checklistItem.checklistId(),
                checklistItem.categoryId(),
                checklistItem.sourceCatalogItemId(),
                checklistItem.title(),
                checklistItem.status()
        );
    }

    public ChecklistItem toDomain(JpaChecklistItemEntity entity) {
        return new ChecklistItem(
                entity.id(),
                entity.checklistId(),
                entity.categoryId(),
                entity.title(),
                entity.sourceCatalogItemId(),
                entity.status()
        );
    }
}
