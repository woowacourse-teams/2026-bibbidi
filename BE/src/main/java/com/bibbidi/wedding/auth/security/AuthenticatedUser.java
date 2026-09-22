package com.bibbidi.wedding.auth.security;

import com.bibbidi.wedding.common.domain.UserRole;
import com.bibbidi.wedding.common.domain.UserStatus;
import java.util.Collection;
import java.util.List;
import org.jspecify.annotations.Nullable;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

/**
 * 요청을 보낸 사용자다. access token에서 꺼낸 값만 담는다.
 *
 * <p>권한은 역할만 담는다. 가입 상태는 다른 축이라 별도 인가 규칙이 본다.
 * 비밀번호로 로그인하지 않으므로 비밀번호는 없다.
 */
public record AuthenticatedUser(
        Long userId,
        UserRole role,
        UserStatus status,
        String nickname,
        @Nullable String email
) implements UserDetails {

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority(SecurityProperties.authorityOf(role)));
    }

    @Override
    public @Nullable String getPassword() {
        return null;
    }

    @Override
    public String getUsername() {
        return String.valueOf(userId);
    }

    public boolean isActive() {
        return status == UserStatus.ACTIVE;
    }
}
