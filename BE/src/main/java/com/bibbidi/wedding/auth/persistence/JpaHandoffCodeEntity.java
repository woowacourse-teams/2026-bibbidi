package com.bibbidi.wedding.auth.persistence;

import com.bibbidi.wedding.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "handoff_codes")
public class JpaHandoffCodeEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "code_hash", nullable = false, length = 64)
    private String codeHash;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "family_id", nullable = false, length = 36)
    private String familyId;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "used_at")
    private LocalDateTime usedAt;

    protected JpaHandoffCodeEntity() {
    }

    public JpaHandoffCodeEntity(
            Long id,
            String codeHash,
            Long userId,
            String familyId,
            LocalDateTime expiresAt,
            LocalDateTime usedAt
    ) {
        this.id = id;
        this.codeHash = codeHash;
        this.userId = userId;
        this.familyId = familyId;
        this.expiresAt = expiresAt;
        this.usedAt = usedAt;
    }

    public Long id() {
        return id;
    }

    public String codeHash() {
        return codeHash;
    }

    public Long userId() {
        return userId;
    }

    public String familyId() {
        return familyId;
    }

    public LocalDateTime expiresAt() {
        return expiresAt;
    }

    public LocalDateTime usedAt() {
        return usedAt;
    }
}
