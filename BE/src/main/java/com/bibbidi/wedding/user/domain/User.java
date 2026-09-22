package com.bibbidi.wedding.user.domain;

import com.bibbidi.wedding.common.domain.UserRole;
import com.bibbidi.wedding.common.domain.UserStatus;
import org.jspecify.annotations.NonNull;
import org.jspecify.annotations.Nullable;

public final class User {

    private final Long id;
    private final String nickname;
    private final UserStatus status;
    private final UserRole role;
    private final String email;

    public User(
            @Nullable Long id,
            @NonNull String nickname,
            @NonNull UserStatus status,
            @NonNull UserRole role,
            @Nullable String email
    ) {
        this.id = id;
        this.nickname = nickname;
        this.status = status;
        this.role = role;
        this.email = email;
    }

    /**
     * 소셜 인증만 끝난 사용자다. 약관에 동의하기 전이라 아직 서비스를 쓸 수 없다.
     */
    public static User pending(String nickname, @Nullable String email) {
        return new User(null, nickname, UserStatus.PENDING, UserRole.NORMAL, email);
    }

    public User changeNickname(String nickname) {
        return new User(id, nickname, status, role, email);
    }

    /**
     * 필수 약관에 모두 동의하면 서비스를 쓸 수 있는 상태가 된다.
     */
    public User activate() {
        return new User(id, nickname, UserStatus.ACTIVE, role, email);
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
}
