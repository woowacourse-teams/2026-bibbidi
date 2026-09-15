package com.bibbidi.wedding.user.domain;

import java.time.LocalDate;
import org.jspecify.annotations.NonNull;
import org.jspecify.annotations.Nullable;

public final class User {

    private final Long id;
    private final String nickname;
    private final String passwordHash;
    private final LocalDate weddingDate;

    public User(
            @Nullable Long id,
            @NonNull String nickname,
            @NonNull String passwordHash,
            @Nullable LocalDate weddingDate
    ) {
        this.id = id;
        this.nickname = nickname;
        this.passwordHash = passwordHash;
        this.weddingDate = weddingDate;
    }

    public User changeNickname(String nickname) {
        return new User(id, nickname, passwordHash, weddingDate);
    }

    public User changePasswordHash(String passwordHash) {
        return new User(id, nickname, passwordHash, weddingDate);
    }

    public User changeWeddingDate(LocalDate weddingDate) {
        return new User(id, nickname, passwordHash, weddingDate);
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
