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

    @Column(name = "wedding_date")
    private LocalDate weddingDate;

    protected JpaUserEntity() {
    }

    public JpaUserEntity(
            Long id,
            String nickname,
            UserStatus status,
            UserRole role,
            String email,
            LocalDate weddingDate
    ) {
        this.id = id;
        this.nickname = nickname;
        this.status = status;
        this.role = role;
        this.email = email;
        this.weddingDate = weddingDate;
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

    public LocalDate weddingDate() {
        return weddingDate;
    }
}
