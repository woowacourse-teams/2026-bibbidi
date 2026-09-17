package com.bibbidi.wedding.checklist.persistence;

import com.bibbidi.wedding.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "checklists")
public class JpaChecklistEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "owner_id", nullable = false, unique = true)
    private Long ownerId;

    protected JpaChecklistEntity() {
    }

    public JpaChecklistEntity(Long id, Long ownerId) {
        this.id = id;
        this.ownerId = ownerId;
    }

    public Long id() {
        return id;
    }

    public Long ownerId() {
        return ownerId;
    }
}
