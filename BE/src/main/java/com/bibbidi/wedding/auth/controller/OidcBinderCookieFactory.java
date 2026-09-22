package com.bibbidi.wedding.auth.controller;

import com.bibbidi.wedding.auth.token.SessionProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.Arrays;
import org.jspecify.annotations.Nullable;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * 인가를 시작한 브라우저에만 남기는 값을 쿠키로 다룬다.
 *
 * <p>state는 인가 주소를 타고 제공자까지 갔다 돌아오므로 주소창이나 기록에 남을 수 있다.
 * 이 쿠키 값은 밖으로 나가지 않아, 돌아온 요청이 정말 시작한 브라우저의 것인지 가릴 수 있다.
 */
@Component
public class OidcBinderCookieFactory {

    private static final String COOKIE_NAME = "BIBBIDI_OIDC_BINDER";
    private static final String COOKIE_PATH = "/api/auth";

    private final RefreshCookieProperties cookieProperties;
    private final SessionProperties sessionProperties;

    public OidcBinderCookieFactory(
            RefreshCookieProperties cookieProperties,
            SessionProperties sessionProperties
    ) {
        this.cookieProperties = cookieProperties;
        this.sessionProperties = sessionProperties;
    }

    public ResponseCookie create(String browserBinder) {
        return build(browserBinder, sessionProperties.authRequestTtl());
    }

    public ResponseCookie expired() {
        return build("", Duration.ZERO);
    }

    /** 쿠키가 없을 수 있다. 네이티브 요청은 쿠키를 쓰지 않는다. */
    public @Nullable String read(HttpServletRequest request) {
        if (request.getCookies() == null) {
            return null;
        }
        return Arrays.stream(request.getCookies())
                .filter(cookie -> COOKIE_NAME.equals(cookie.getName()))
                .map(Cookie::getValue)
                .filter(value -> value != null && !value.isBlank())
                .findFirst()
                .orElse(null);
    }

    private ResponseCookie build(String value, Duration maxAge) {
        return ResponseCookie.from(COOKIE_NAME, value)
                .httpOnly(true)
                .secure(cookieProperties.secure())
                .path(COOKIE_PATH)
                .sameSite(cookieProperties.sameSite())
                .maxAge(maxAge)
                .build();
    }
}
