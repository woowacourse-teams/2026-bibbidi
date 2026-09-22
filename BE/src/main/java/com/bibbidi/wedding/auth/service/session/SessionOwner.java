package com.bibbidi.wedding.auth.service.session;

import com.bibbidi.wedding.common.domain.UserRole;
import com.bibbidi.wedding.common.domain.UserStatus;
import org.jspecify.annotations.Nullable;

/** 토큰에 실을 사용자 정보다. */
public record SessionOwner(
        Long userId,
        UserStatus status,
        UserRole role,
        String nickname,
        @Nullable String email
) {
}
