package com.bibbidi.wedding.auth.controller;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import java.util.Arrays;
import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
public class RefreshTokenCookieManager {

    private static final String SAME_SITE_LAX = "Lax";

    private final AuthWebProperties authWebProperties;

    public RefreshTokenCookieManager(AuthWebProperties authWebProperties) {
        this.authWebProperties = authWebProperties;
    }

    public Optional<String> findRefreshToken(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return Optional.empty();
        }

        return Arrays.stream(cookies)
                .filter(cookie -> authWebProperties.refreshCookieName().equals(cookie.getName()))
                .map(Cookie::getValue)
                .filter(value -> !value.isBlank())
                .findFirst();
    }

    public void attach(HttpServletResponse response, String refreshToken, Duration maxAge) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookieBuilder(refreshToken, maxAge).build().toString());
    }

    public void expire(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookieBuilder("", Duration.ZERO).build().toString());
    }

    private ResponseCookie.ResponseCookieBuilder cookieBuilder(String value, Duration maxAge) {
        return ResponseCookie.from(authWebProperties.refreshCookieName(), value)
                .path(authWebProperties.refreshCookiePath())
                .secure(authWebProperties.refreshCookieSecure())
                .httpOnly(true)
                .sameSite(SAME_SITE_LAX)
                .maxAge(maxAge);
    }
}
