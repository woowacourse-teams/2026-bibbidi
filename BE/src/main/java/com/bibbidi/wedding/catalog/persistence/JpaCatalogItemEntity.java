package com.bibbidi.wedding.catalog.persistence;

import com.bibbidi.wedding.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "catalog_items")
public class JpaCatalogItemEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "step_id", nullable = false)
    private Long stepId;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @Column(name = "essential", nullable = false)
    private boolean essential;

    protected JpaCatalogItemEntity() {
    }

    public JpaCatalogItemEntity(
            Long id,
            Long stepId,
            String title,
            int displayOrder,
            boolean essential
    ) {
        this.id = id;
        this.stepId = stepId;
        this.title = title;
        this.displayOrder = displayOrder;
        this.essential = essential;
    }

    public Long id() {
        return id;
    }

    public Long stepId() {
        return stepId;
    }

    public String title() {
        return title;
    }

    public int displayOrder() {
        return displayOrder;
    }

    public boolean essential() {
        return essential;
    }
}
