package com.bibbidi.wedding.auth.token;

import com.bibbidi.wedding.common.domain.UserRole;
import com.bibbidi.wedding.common.domain.UserStatus;
import org.jspecify.annotations.Nullable;

/**
 * access token이 싣고 다니는 값이다.
 * JWT는 서명만 되고 암호화되지 않으므로 여기에 담은 값은 토큰을 가진 쪽이 그대로 읽을 수 있다.
 */
public record BibbidiTokenClaims(
        Long userId,
        UserStatus status,
        UserRole role,
        String nickname,
        @Nullable String email
) {
}
