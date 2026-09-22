package com.bibbidi.wedding.auth.controller;

import com.bibbidi.wedding.auth.token.SessionProperties;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.Arrays;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * 웹은 refresh token을 자바스크립트가 읽을 수 없는 쿠키로 주고받는다.
 * 네이티브는 이 쿠키를 쓰지 않고 응답 본문으로 받는다.
 */
@Component
public class RefreshCookieFactory {

    private final RefreshCookieProperties cookieProperties;
    private final SessionProperties sessionProperties;

    public RefreshCookieFactory(
            RefreshCookieProperties cookieProperties,
            SessionProperties sessionProperties
    ) {
        this.cookieProperties = cookieProperties;
        this.sessionProperties = sessionProperties;
    }

    public ResponseCookie create(String refreshToken) {
        return build(refreshToken, sessionProperties.refreshTokenTtl());
    }

    public ResponseCookie expired() {
        return build("", Duration.ZERO);
    }

    public String read(HttpServletRequest request) {
        if (request.getCookies() == null) {
            throw new BusinessException(ClientError.REFRESH_SESSION_INVALID, "요청에 쿠키가 없습니다.");
        }
        return Arrays.stream(request.getCookies())
                .filter(cookie -> cookieProperties.name().equals(cookie.getName()))
                .map(jakarta.servlet.http.Cookie::getValue)
                .filter(value -> value != null && !value.isBlank())
                .findFirst()
                .orElseThrow(() -> new BusinessException(
                        ClientError.REFRESH_SESSION_INVALID, "요청에 refresh 쿠키가 없습니다."));
    }

    private ResponseCookie build(String value, Duration maxAge) {
        return ResponseCookie.from(cookieProperties.name(), value)
                .httpOnly(true)
                .secure(cookieProperties.secure())
                .path(cookieProperties.path())
                .sameSite(cookieProperties.sameSite())
                .maxAge(maxAge)
                .build();
    }
}
