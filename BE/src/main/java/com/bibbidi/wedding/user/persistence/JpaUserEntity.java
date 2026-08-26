package com.bibbidi.wedding.user.persistence;

import com.bibbidi.wedding.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

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

    protected JpaUserEntity() {
    }

    public JpaUserEntity(Long id, String nickname, String passwordHash) {
        this.id = id;
        this.nickname = nickname;
        this.passwordHash = passwordHash;
    }

    public void changeNickname(String nickname) {
        this.nickname = nickname;
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
}
