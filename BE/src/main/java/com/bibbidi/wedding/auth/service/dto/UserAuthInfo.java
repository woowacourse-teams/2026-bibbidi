package com.bibbidi.wedding.auth.service.dto;

import com.bibbidi.wedding.common.domain.UserRole;
import com.bibbidi.wedding.common.domain.UserStatus;
import org.jspecify.annotations.Nullable;

public record UserAuthInfo(
        Long userId,
        UserStatus status,
        UserRole role,
        String nickname,
        @Nullable String email
) {
}
