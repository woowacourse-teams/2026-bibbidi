package com.bibbidi.wedding.auth.token;

import com.bibbidi.wedding.common.domain.UserRole;
import com.bibbidi.wedding.common.domain.UserStatus;
import org.jspecify.annotations.Nullable;

public record BibbidiTokenClaims(
        Long userId,
        UserStatus status,
        UserRole role,
        String nickname,
        @Nullable String email
) {
}
