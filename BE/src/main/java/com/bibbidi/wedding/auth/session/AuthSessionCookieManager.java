package com.bibbidi.wedding.auth.session;

import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import org.springframework.boot.web.server.Cookie;
import org.springframework.boot.web.server.autoconfigure.ServerProperties;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
public class AuthSessionCookieManager {

    private final String cookieName;
    private final String cookiePath;
    private final boolean cookieSecure;

    public AuthSessionCookieManager(ServerProperties serverProperties) {
        Cookie cookie = serverProperties.getServlet().getSession().getCookie();

        this.cookieName = cookie.getName();
        this.cookiePath = cookie.getPath();
        this.cookieSecure = Boolean.TRUE.equals(cookie.getSecure());
    }

    public void expire(HttpServletResponse response) {
        ResponseCookie expiredCookie = ResponseCookie.from(cookieName, "")
                .path(cookiePath)
                .secure(cookieSecure)
                .maxAge(Duration.ZERO)
                .build();

        response.addHeader(HttpHeaders.SET_COOKIE, expiredCookie.toString());
    }
}
