package com.bibbidi.wedding.auth.controller;

import com.bibbidi.wedding.auth.controller.dto.LoginRequest;
import com.bibbidi.wedding.auth.controller.dto.LoginResponse;
import com.bibbidi.wedding.auth.service.AuthResult;
import com.bibbidi.wedding.auth.service.AuthService;
import com.bibbidi.wedding.auth.session.Auth;
import com.bibbidi.wedding.auth.session.AuthSession;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.time.Duration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController {

    private static final String SESSION_COOKIE_NAME = "JSESSIONID";

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/api/login")
    public ResponseEntity<LoginResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest servletRequest
    ) {
        AuthResult result = authService.login(request.nickname(), request.password());
        replaceSession(servletRequest, result.userId());
        return ResponseEntity.ok(LoginResponse.from(result));
    }

    @Auth
    @DeleteMapping("/api/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        request.getSession(false).invalidate();
        clearSessionCookie(response);
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

    private void clearSessionCookie(HttpServletResponse response) {
        ResponseCookie expiredCookie = ResponseCookie.from(SESSION_COOKIE_NAME, "")
                .path("/")
                .httpOnly(true)
                .maxAge(Duration.ZERO)
                .build();

        response.addHeader(HttpHeaders.SET_COOKIE, expiredCookie.toString());
    }
}
