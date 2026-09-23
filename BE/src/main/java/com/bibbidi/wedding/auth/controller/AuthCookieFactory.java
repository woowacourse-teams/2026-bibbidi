package com.bibbidi.wedding.auth.controller;

import com.bibbidi.wedding.auth.config.RefreshCookieProperties;
import com.bibbidi.wedding.auth.config.SessionProperties;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.Arrays;
import org.jspecify.annotations.Nullable;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
public class AuthCookieFactory {

    private static final String OIDC_BINDER_COOKIE_NAME = "BIBBIDI_OIDC_BINDER";
    private static final String OIDC_BINDER_COOKIE_PATH = "/api/auth";

    private final RefreshCookieProperties cookieProperties;
    private final SessionProperties sessionProperties;

    public AuthCookieFactory(
            RefreshCookieProperties cookieProperties,
            SessionProperties sessionProperties
    ) {
        this.cookieProperties = cookieProperties;
        this.sessionProperties = sessionProperties;
    }

    public ResponseCookie refreshToken(String refreshToken) {
        return build(
                cookieProperties.name(),
                cookieProperties.path(),
                refreshToken,
                sessionProperties.refreshTokenLifetime());
    }

    public ResponseCookie expiredRefreshToken() {
        return build(
                cookieProperties.name(),
                cookieProperties.path(),
                "",
                Duration.ZERO);
    }

    public String readRefreshToken(HttpServletRequest request) {
        String refreshToken = read(request, cookieProperties.name());
        if (refreshToken == null) {
            throw new BusinessException(
                    ClientError.REFRESH_SESSION_INVALID, "요청에 refresh 쿠키가 없습니다.");
        }
        return refreshToken;
    }

    public boolean hasRefreshToken(HttpServletRequest request) {
        return read(request, cookieProperties.name()) != null;
    }

    public ResponseCookie oidcBinder(String browserBinder) {
        return build(
                OIDC_BINDER_COOKIE_NAME,
                OIDC_BINDER_COOKIE_PATH,
                browserBinder,
                sessionProperties.authRequestLifetime());
    }

    public ResponseCookie expiredOidcBinder() {
        return build(
                OIDC_BINDER_COOKIE_NAME,
                OIDC_BINDER_COOKIE_PATH,
                "",
                Duration.ZERO);
    }

    public @Nullable String readOidcBinder(HttpServletRequest request) {
        return read(request, OIDC_BINDER_COOKIE_NAME);
    }

    private @Nullable String read(HttpServletRequest request, String name) {
        if (request.getCookies() == null) {
            return null;
        }
        return Arrays.stream(request.getCookies())
                .filter(cookie -> name.equals(cookie.getName()))
                .map(Cookie::getValue)
                .filter(value -> value != null && !value.isBlank())
                .findFirst()
                .orElse(null);
    }

    private ResponseCookie build(String name, String path, String value, Duration maxAge) {
        return ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(cookieProperties.secure())
                .path(path)
                .sameSite(cookieProperties.sameSite())
                .maxAge(maxAge)
                .build();
    }
}
