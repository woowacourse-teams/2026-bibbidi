package com.bibbidi.wedding.user.persistence;

import com.bibbidi.wedding.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "users")
public class UserEntity extends BaseTimeEntity {

    @Id
    @JdbcTypeCode(SqlTypes.BINARY)
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "nickname", nullable = false, unique = true)
    private String nickname;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    protected UserEntity() {
    }

    public UserEntity(UUID id, String nickname, String passwordHash) {
        this.id = id;
        this.nickname = nickname;
        this.passwordHash = passwordHash;
    }

    public UUID id() {
        return id;
    }

    public String nickname() {
        return nickname;
    }

    public String passwordHash() {
        return passwordHash;
    }
}
