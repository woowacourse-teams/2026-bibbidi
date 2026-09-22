package com.bibbidi.wedding.auth.security;

import com.bibbidi.wedding.auth.config.SecurityProperties;
import com.bibbidi.wedding.common.domain.UserRole;
import com.bibbidi.wedding.common.domain.UserStatus;
import java.util.Collection;
import java.util.List;
import org.jspecify.annotations.Nullable;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

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
