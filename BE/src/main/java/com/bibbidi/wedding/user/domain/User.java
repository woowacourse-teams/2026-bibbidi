package com.bibbidi.wedding.user.domain;

import org.jspecify.annotations.NonNull;
import org.jspecify.annotations.Nullable;

public final class User {

    private final Long id;
    private final String nickname;
    private final String passwordHash;

    public User(@Nullable Long id, @NonNull String nickname, @NonNull String passwordHash) {
        this.id = id;
        this.nickname = nickname;
        this.passwordHash = passwordHash;
    }

    public User changeNickname(String nickname) {
        return new User(id, nickname, passwordHash);
    }

    public User changePasswordHash(String passwordHash) {
        return new User(id, nickname, passwordHash);
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
