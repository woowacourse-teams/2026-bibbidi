package com.bibbidi.wedding.user.domain;

import com.bibbidi.wedding.common.domain.UserRole;
import com.bibbidi.wedding.common.domain.UserStatus;
import java.time.LocalDateTime;
import org.jspecify.annotations.NonNull;
import org.jspecify.annotations.Nullable;

public final class User {

    private final Long id;
    private final String nickname;
    private final UserStatus status;
    private final UserRole role;
    private final String email;
    private final String termsVersion;
    private final LocalDateTime termsAgreedAt;

    public User(
            @Nullable Long id,
            @NonNull String nickname,
            @NonNull UserStatus status,
            @NonNull UserRole role,
            @Nullable String email,
            @Nullable String termsVersion,
            @Nullable LocalDateTime termsAgreedAt
    ) {
        this.id = id;
        this.nickname = nickname;
        this.status = status;
        this.role = role;
        this.email = email;
        this.termsVersion = termsVersion;
        this.termsAgreedAt = termsAgreedAt;
    }

    public User(
            @Nullable Long id,
            @NonNull String nickname,
            @NonNull UserStatus status,
            @NonNull UserRole role,
            @Nullable String email
    ) {
        this(id, nickname, status, role, email, null, null);
    }

    public static User pending(String nickname, @Nullable String email) {
        return new User(null, nickname, UserStatus.PENDING, UserRole.NORMAL, email, null, null);
    }

    public User changeNickname(String nickname) {
        return new User(id, nickname, status, role, email, termsVersion, termsAgreedAt);
    }

    public User activate() {
        return agreeToTerms(termsVersion, LocalDateTime.now());
    }

    public User agreeToTerms(String termsVersion, LocalDateTime agreedAt) {
        return new User(id, nickname, UserStatus.ACTIVE, role, email, termsVersion, agreedAt);
    }

    public boolean isActive() {
        return status == UserStatus.ACTIVE;
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

    public @Nullable String email() {
        return email;
    }

    public @Nullable String termsVersion() {
        return termsVersion;
    }

    public @Nullable LocalDateTime termsAgreedAt() {
        return termsAgreedAt;
    }
}
