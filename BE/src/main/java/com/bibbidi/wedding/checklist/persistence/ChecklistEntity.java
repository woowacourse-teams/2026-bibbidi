package com.bibbidi.wedding.checklist.persistence;

import com.bibbidi.wedding.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "checklists")
public class ChecklistEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @JdbcTypeCode(SqlTypes.BINARY)
    @Column(name = "owner_id", nullable = false, unique = true)
    private UUID ownerId;

    protected ChecklistEntity() {
    }

    public ChecklistEntity(Long id, UUID ownerId) {
        this.id = id;
        this.ownerId = ownerId;
    }

    public Long id() {
        return id;
    }

    public UUID ownerId() {
        return ownerId;
    }
}
