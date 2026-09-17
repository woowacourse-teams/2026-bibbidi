package com.bibbidi.wedding.auth.session;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Component;

@Component
public class AuthSessionManager {

    private final AuthSessionCookieManager sessionCookieManager;

    public AuthSessionManager(AuthSessionCookieManager sessionCookieManager) {
        this.sessionCookieManager = sessionCookieManager;
    }

    public void replaceWithAuthenticatedSession(HttpServletRequest request, Long userId) {
        invalidateCurrentSession(request);

        HttpSession authenticatedSession = request.getSession(true);
        authenticatedSession.setAttribute(AuthSession.USER_ID_ATTRIBUTE, userId);
    }

    public void invalidate(HttpServletRequest request, HttpServletResponse response) {
        invalidateCurrentSession(request);
        sessionCookieManager.expire(response);
    }

    private void invalidateCurrentSession(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
    }
}
