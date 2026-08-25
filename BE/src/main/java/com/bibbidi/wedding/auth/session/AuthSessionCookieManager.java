package com.bibbidi.wedding.auth.session;

import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import java.util.Objects;
import org.springframework.boot.web.server.Cookie;
import org.springframework.boot.web.server.autoconfigure.ServerProperties;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
public class AuthSessionCookieManager {

    private final String cookieName;
    private final String cookiePath;

    public AuthSessionCookieManager(ServerProperties serverProperties) {
        Cookie cookie = serverProperties.getServlet().getSession().getCookie();

        this.cookieName = Objects.requireNonNull(
                cookie.getName(),
                "Session Cookie 이름을 설정해야 합니다."
        );
        this.cookiePath = Objects.requireNonNull(
                cookie.getPath(),
                "Session Cookie 경로를 설정해야 합니다."
        );
    }

    public void expire(HttpServletResponse response) {
        ResponseCookie expiredCookie = ResponseCookie.from(cookieName, "")
                .path(cookiePath)
                .maxAge(Duration.ZERO)
                .build();

        response.addHeader(HttpHeaders.SET_COOKIE, expiredCookie.toString());
    }
}
