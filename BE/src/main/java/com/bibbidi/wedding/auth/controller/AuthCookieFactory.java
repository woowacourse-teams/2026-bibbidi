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

/**
 * 웹 브라우저에 내려 주는 인증 쿠키를 만든다.
 *
 * <p>두 가지를 다룬다. refresh token은 자바스크립트가 읽을 수 없어야 하므로 쿠키로 주고받고,
 * 인가를 시작한 브라우저인지 가리는 값도 같은 방식으로 심는다.
 * 네이티브 앱은 쿠키를 쓰지 않고 응답 본문으로 주고받는다.
 */
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
        return build(cookieProperties.name(), cookieProperties.path(), "", Duration.ZERO);
    }

    /** refresh 쿠키가 없으면 로그인 상태를 이어 갈 수 없으므로 오류로 끝낸다. */
    public String readRefreshToken(HttpServletRequest request) {
        String refreshToken = read(request, cookieProperties.name());
        if (refreshToken == null) {
            throw new BusinessException(
                    ClientError.REFRESH_SESSION_INVALID, "요청에 refresh 쿠키가 없습니다.");
        }
        return refreshToken;
    }

    /**
     * 인가를 시작한 브라우저에만 남기는 값이다.
     *
     * <p>state는 인가 주소를 타고 제공자까지 갔다 돌아오므로 주소창이나 기록에 남을 수 있다.
     * 이 값은 밖으로 나가지 않아, 돌아온 요청이 시작한 브라우저의 것인지 가릴 수 있다.
     */
    public ResponseCookie oidcBinder(String browserBinder) {
        return build(
                OIDC_BINDER_COOKIE_NAME,
                OIDC_BINDER_COOKIE_PATH,
                browserBinder,
                sessionProperties.authRequestLifetime());
    }

    public ResponseCookie expiredOidcBinder() {
        return build(OIDC_BINDER_COOKIE_NAME, OIDC_BINDER_COOKIE_PATH, "", Duration.ZERO);
    }

    /** 없을 수 있다. 네이티브 요청은 쿠키를 쓰지 않는다. */
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
