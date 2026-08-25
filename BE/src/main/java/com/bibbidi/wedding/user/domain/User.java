package com.bibbidi.wedding.user.domain;

import java.util.Objects;

public final class User {

    private final Long id;
    private final String nickname;
    private final String passwordHash;

    private User(Long id, String nickname, String passwordHash) {
        this.id = id;
        this.nickname = Objects.requireNonNull(nickname);
        this.passwordHash = Objects.requireNonNull(passwordHash);
    }

    public static User create(String nickname, String passwordHash) {
        return new User(null, nickname, passwordHash);
    }

    public static User restore(Long id, String nickname, String passwordHash) {
        return new User(Objects.requireNonNull(id), nickname, passwordHash);
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
