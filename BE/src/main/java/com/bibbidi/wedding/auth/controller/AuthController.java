package com.bibbidi.wedding.auth.controller;

import com.bibbidi.wedding.auth.controller.dto.CreateUserRequest;
import com.bibbidi.wedding.auth.controller.dto.CreateUserResponse;
import com.bibbidi.wedding.auth.controller.dto.LoginRequest;
import com.bibbidi.wedding.auth.controller.dto.LoginResponse;
import com.bibbidi.wedding.auth.service.AuthResult;
import com.bibbidi.wedding.auth.service.AuthService;
import com.bibbidi.wedding.auth.session.AuthSession;
import com.bibbidi.wedding.auth.session.AuthSessionCookieManager;
import com.bibbidi.wedding.user.service.UserCreationResult;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController {

    private final AuthService authService;
    private final AuthSessionCookieManager sessionCookieManager;

    public AuthController(
            AuthService authService,
            AuthSessionCookieManager sessionCookieManager
    ) {
        this.authService = authService;
        this.sessionCookieManager = sessionCookieManager;
    }

    @PostMapping("/api/users")
    public ResponseEntity<CreateUserResponse> createUser(@Valid @RequestBody CreateUserRequest request) {
        UserCreationResult result = authService.register(request.nickname(), request.password());
        return ResponseEntity.status(HttpStatus.CREATED).body(CreateUserResponse.from(result));
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
