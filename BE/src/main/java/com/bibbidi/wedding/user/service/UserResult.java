package com.bibbidi.wedding.user.service;

import com.bibbidi.wedding.common.domain.UserRole;
import com.bibbidi.wedding.common.domain.UserStatus;
import com.bibbidi.wedding.user.domain.User;
import org.jspecify.annotations.Nullable;

public record UserResult(
        long id,
        String nickname,
        UserStatus status,
        UserRole role,
        @Nullable String email
) {

    public static UserResult from(User user) {
        return new UserResult(user.id(), user.nickname(), user.status(), user.role(), user.email());
    }
}
