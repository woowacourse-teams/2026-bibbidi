package com.bibbidi.wedding.user.persistence;

import com.bibbidi.wedding.common.domain.UserRole;
import com.bibbidi.wedding.common.domain.UserStatus;
import com.bibbidi.wedding.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
public class JpaUserEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "nickname", nullable = false)
    private String nickname;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private UserStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private UserRole role;

    @Column(name = "email")
    private String email;

    @Column(name = "terms_version", length = 20)
    private String termsVersion;

    @Column(name = "terms_agreed_at")
    private LocalDateTime termsAgreedAt;

    @Column(name = "wedding_date")
    private LocalDate weddingDate;

    @Column(name = "password_hash", insertable = false, updatable = false)
    private String passwordHash;

    protected JpaUserEntity() {
    }

    public JpaUserEntity(
            Long id,
            String nickname,
            UserStatus status,
            UserRole role,
            String email,
            String termsVersion,
            LocalDateTime termsAgreedAt,
            LocalDate weddingDate
    ) {
        this.id = id;
        this.nickname = nickname;
        this.status = status;
        this.role = role;
        this.email = email;
        this.termsVersion = termsVersion;
        this.termsAgreedAt = termsAgreedAt;
        this.weddingDate = weddingDate;
    }

    public JpaUserEntity(
            Long id,
            String nickname,
            UserStatus status,
            UserRole role,
            String email,
            LocalDate weddingDate
    ) {
        this(id, nickname, status, role, email, null, null, weddingDate);
    }

    public Long id() {
        return id;
    }

    public String nickname() {
        return nickname;
    }

    public UserStatus status() {
        return status;
    }

    public UserRole role() {
        return role;
    }

    public String email() {
        return email;
    }

    public String termsVersion() {
        return termsVersion;
    }

    public LocalDateTime termsAgreedAt() {
        return termsAgreedAt;
    }

    public LocalDate weddingDate() {
        return weddingDate;
    }

    public String passwordHash() {
        return passwordHash;
    }
}
