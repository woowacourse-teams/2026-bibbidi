package com.bibbidi.wedding.auth.controller;

import com.bibbidi.wedding.auth.controller.dto.ChangePasswordRequest;
import com.bibbidi.wedding.auth.controller.dto.CreateUserRequest;
import com.bibbidi.wedding.auth.controller.dto.CreateUserResponse;
import com.bibbidi.wedding.auth.controller.dto.LoginRequest;
import com.bibbidi.wedding.auth.controller.dto.LoginResponse;
import com.bibbidi.wedding.auth.service.AuthResult;
import com.bibbidi.wedding.auth.service.AuthService;
import com.bibbidi.wedding.auth.session.Auth;
import com.bibbidi.wedding.auth.session.AuthSessionManager;
import com.bibbidi.wedding.user.controller.dto.DeleteUserRequest;
import com.bibbidi.wedding.user.service.UserDeletionService;
import com.bibbidi.wedding.user.service.UserResult;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController {

    private final AuthService authService;
    private final UserDeletionService userDeletionService;
    private final AuthSessionManager sessionManager;

    public AuthController(
            AuthService authService,
            UserDeletionService userDeletionService,
            AuthSessionManager sessionManager
    ) {
        this.authService = authService;
        this.userDeletionService = userDeletionService;
        this.sessionManager = sessionManager;
    }

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/api/users")
    public CreateUserResponse createUser(@Valid @RequestBody CreateUserRequest request) {
        UserResult result = authService.register(request.nickname(), request.password());
        return CreateUserResponse.from(result);
    }

    @PostMapping("/api/login")
    public LoginResponse login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest servletRequest
    ) {
        AuthResult result = authService.login(request.nickname(), request.password());
        sessionManager.replaceWithAuthenticatedSession(servletRequest, result.userId());
        return LoginResponse.from(result);
    }

    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping("/api/logout")
    public void logout(HttpServletRequest request, HttpServletResponse response) {
        sessionManager.invalidate(request, response);
    }

    @PutMapping("/api/users/me/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(
            @Auth Long currentUserId,
            @Valid @RequestBody ChangePasswordRequest request
    ) {
        authService.changePassword(currentUserId, request.currentPassword(), request.newPassword());
    }

    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping("/api/users/me")
    public void deleteCurrentUser(
            @Auth Long currentUserId,
            @Valid @RequestBody DeleteUserRequest request,
            HttpServletRequest servletRequest,
            HttpServletResponse servletResponse
    ) {
        userDeletionService.delete(currentUserId, request.password());
        sessionManager.invalidate(servletRequest, servletResponse);
    }
}
