package com.bibbidi.wedding.auth.persistence;

import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/**
 * 살아 있는 refresh token 하나를 나타낸다.
 * 토큰 원문은 저장하지 않고 해시만 남긴다. 같은 기기에서 이어진 토큰은 family_id를 공유한다.
 */
@Entity
@Table(name = "refresh_sessions")
public class JpaRefreshSessionEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "family_id", nullable = false, length = 36)
    private String familyId;

    @Enumerated(EnumType.STRING)
    @Column(name = "client_type", nullable = false, length = 10)
    private ClientType clientType;

    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    @Column(name = "rotated_at")
    private LocalDateTime rotatedAt;

    protected JpaRefreshSessionEntity() {
    }

    public JpaRefreshSessionEntity(
            Long id,
            Long userId,
            String familyId,
            ClientType clientType,
            String tokenHash,
            LocalDateTime expiresAt,
            LocalDateTime revokedAt,
            LocalDateTime rotatedAt
    ) {
        this.id = id;
        this.userId = userId;
        this.familyId = familyId;
        this.clientType = clientType;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
        this.revokedAt = revokedAt;
        this.rotatedAt = rotatedAt;
    }

    public Long id() {
        return id;
    }

    public Long userId() {
        return userId;
    }

    public String familyId() {
        return familyId;
    }

    public ClientType clientType() {
        return clientType;
    }

    public String tokenHash() {
        return tokenHash;
    }

    public LocalDateTime expiresAt() {
        return expiresAt;
    }

    public LocalDateTime revokedAt() {
        return revokedAt;
    }

    public LocalDateTime rotatedAt() {
        return rotatedAt;
    }
}
