package com.bibbidi.wedding.checklist.persistence;

import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import com.bibbidi.wedding.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
        name = "checklist_items",
        uniqueConstraints = @UniqueConstraint(columnNames = {"checklist_id", "source_catalog_item_id"})
)
public class JpaChecklistItemEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "checklist_id", nullable = false)
    private JpaChecklistEntity checklist;

    @Column(name = "category_id")
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
            JpaChecklistEntity checklist,
            Long categoryId,
            Long sourceCatalogItemId,
            String title,
            ChecklistItemStatus status
    ) {
        this.id = id;
        this.checklist = checklist;
        this.categoryId = categoryId;
        this.sourceCatalogItemId = sourceCatalogItemId;
        this.title = title;
        this.status = status;
    }

    public Long id() {
        return id;
    }

    public JpaChecklistEntity checklist() {
        return checklist;
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
