package com.bibbidi.wedding.catalog.persistence;

import com.bibbidi.wedding.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "steps")
public class JpaStepEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "category_id", nullable = false)
    private Long categoryId;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "icon_url", length = 255)
    private String iconUrl;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    protected JpaStepEntity() {
    }

    public JpaStepEntity(
            Long id,
            Long categoryId,
            String name,
            String description,
            String iconUrl,
            int displayOrder
    ) {
        this.id = id;
        this.categoryId = categoryId;
        this.name = name;
        this.description = description;
        this.iconUrl = iconUrl;
        this.displayOrder = displayOrder;
    }

    public Long id() {
        return id;
    }

    public Long categoryId() {
        return categoryId;
    }

    public String name() {
        return name;
    }

    public String description() {
        return description;
    }

    public String iconUrl() {
        return iconUrl;
    }

    public int displayOrder() {
        return displayOrder;
    }
}
