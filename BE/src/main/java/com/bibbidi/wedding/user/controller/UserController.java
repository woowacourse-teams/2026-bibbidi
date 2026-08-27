package com.bibbidi.wedding.user.controller;

import com.bibbidi.wedding.auth.session.Auth;
import com.bibbidi.wedding.user.controller.dto.ChangeNicknameRequest;
import com.bibbidi.wedding.user.controller.dto.ChangeNicknameResponse;
import com.bibbidi.wedding.user.service.NicknameChangeResult;
import com.bibbidi.wedding.user.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @PutMapping("/me/nickname")
    public ResponseEntity<ChangeNicknameResponse> changeNickname(
            @Auth Long currentUserId,
            @Valid @RequestBody ChangeNicknameRequest request
    ) {
        NicknameChangeResult result = userService.changeNickname(currentUserId, request.nickname());
        return ResponseEntity.ok(ChangeNicknameResponse.from(result));
    }
}
