package com.bibbidi.wedding.user.persistence;

import com.bibbidi.wedding.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

    @Column(name = "nickname", nullable = false, unique = true, length = 10)
    private String nickname;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "wedding_date")
    private LocalDate weddingDate;

    protected JpaUserEntity() {
    }

    public JpaUserEntity(Long id, String nickname, String passwordHash, LocalDate weddingDate) {
        this.id = id;
        this.nickname = nickname;
        this.passwordHash = passwordHash;
        this.weddingDate = weddingDate;
    }

    public Long id() {
        return id;
    }

    public String nickname() {
        return nickname;
    }

    public String passwordHash() {
        return passwordHash;
    }

    public LocalDate weddingDate() {
        return weddingDate;
    }
}
