package com.bibbidi.wedding.user.domain;

import java.util.Objects;
import java.util.UUID;

public final class User {

    private final UUID id;
    private final String nickname;
    private final String passwordHash;

    private User(UUID id, String nickname, String passwordHash) {
        this.id = Objects.requireNonNull(id);
        this.nickname = Objects.requireNonNull(nickname);
        this.passwordHash = Objects.requireNonNull(passwordHash);
    }

    public static User create(String nickname, String passwordHash) {
        return new User(UUID.randomUUID(), nickname, passwordHash);
    }

    public static User restore(UUID id, String nickname, String passwordHash) {
        return new User(id, nickname, passwordHash);
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
