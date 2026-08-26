package com.bibbidi.wedding.auth.controller;

import com.bibbidi.wedding.auth.controller.dto.LoginRequest;
import com.bibbidi.wedding.auth.controller.dto.LoginResponse;
import com.bibbidi.wedding.auth.session.AuthSession;
import com.bibbidi.wedding.auth.session.AuthSessionCookieManager;
import com.bibbidi.wedding.user.authentication.AuthenticatedUser;
import com.bibbidi.wedding.user.authentication.UserAuthenticationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController {

    private final UserAuthenticationService userAuthenticationService;
    private final AuthSessionCookieManager sessionCookieManager;

    public AuthController(
            UserAuthenticationService userAuthenticationService,
            AuthSessionCookieManager sessionCookieManager
    ) {
        this.userAuthenticationService = userAuthenticationService;
        this.sessionCookieManager = sessionCookieManager;
    }

    @PostMapping("/api/login")
    public ResponseEntity<LoginResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest servletRequest
    ) {
        AuthenticatedUser result = userAuthenticationService.authenticate(request.nickname(), request.password());
        replaceSession(servletRequest, result.userId());
        return ResponseEntity.ok(LoginResponse.from(result));
    }

    @DeleteMapping("/api/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        sessionCookieManager.expire(response);
        return ResponseEntity.noContent().build();
    }

    private void replaceSession(HttpServletRequest request, Long userId) {
        HttpSession previousSession = request.getSession(false);
        if (previousSession != null) {
            previousSession.invalidate();
        }

        HttpSession authenticatedSession = request.getSession(true);
        authenticatedSession.setAttribute(AuthSession.USER_ID_ATTRIBUTE, userId);
    }
}
