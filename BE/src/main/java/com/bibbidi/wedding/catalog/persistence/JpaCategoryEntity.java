package com.bibbidi.wedding.catalog.persistence;

import com.bibbidi.wedding.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "categories")
public class JpaCategoryEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    protected JpaCategoryEntity() {
    }

    public JpaCategoryEntity(Long id, String name, int displayOrder) {
        this.id = id;
        this.name = name;
        this.displayOrder = displayOrder;
    }

    public Long id() {
        return id;
    }

    public String name() {
        return name;
    }

    public int displayOrder() {
        return displayOrder;
    }
}
