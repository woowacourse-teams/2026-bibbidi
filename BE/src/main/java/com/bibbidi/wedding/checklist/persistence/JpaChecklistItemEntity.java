package com.bibbidi.wedding.checklist.persistence;

import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import com.bibbidi.wedding.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "checklist_items")
public class JpaChecklistItemEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "checklist_id", nullable = false)
    private Long checklistId;

    @Column(name = "category_id", nullable = false)
    private Long categoryId;

    @Column(name = "source_catalog_item_id")
    private Long sourceCatalogItemId;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ChecklistItemStatus status;

    protected JpaChecklistItemEntity() {
    }

    public JpaChecklistItemEntity(
            Long id,
            Long checklistId,
            Long categoryId,
            Long sourceCatalogItemId,
            String title,
            ChecklistItemStatus status
    ) {
        this.id = id;
        this.checklistId = checklistId;
        this.categoryId = categoryId;
        this.sourceCatalogItemId = sourceCatalogItemId;
        this.title = title;
        this.status = status;
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

    public Long sourceCatalogItemId() {
        return sourceCatalogItemId;
    }

    public String title() {
        return title;
    }

    public ChecklistItemStatus status() {
        return status;
    }
}
