package com.bibbidi.wedding.user.controller;

import com.bibbidi.wedding.auth.service.AuthService;
import com.bibbidi.wedding.auth.session.Auth;
import com.bibbidi.wedding.user.controller.dto.ChangeNicknameRequest;
import com.bibbidi.wedding.user.controller.dto.ChangeNicknameResponse;
import com.bibbidi.wedding.user.controller.dto.ChangePasswordRequest;
import com.bibbidi.wedding.user.service.NicknameChangeResult;
import com.bibbidi.wedding.user.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class UserController {

    private final UserService userService;
    private final AuthService authService;

    public UserController(UserService userService, AuthService authService) {
        this.userService = userService;
        this.authService = authService;
    }

    @PutMapping("/api/users/me/nickname")
    public ResponseEntity<ChangeNicknameResponse> changeNickname(
            @Auth Long currentUserId,
            @Valid @RequestBody ChangeNicknameRequest request
    ) {
        NicknameChangeResult result = userService.changeNickname(currentUserId, request.nickname());
        return ResponseEntity.ok(ChangeNicknameResponse.from(result));
    }

    @PutMapping("/api/users/me/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(
            @Auth Long currentUserId,
            @Valid @RequestBody ChangePasswordRequest request
    ) {
        authService.changePassword(currentUserId, request.currentPassword(), request.newPassword());
    }
}
