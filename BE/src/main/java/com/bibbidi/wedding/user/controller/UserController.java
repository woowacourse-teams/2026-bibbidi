package com.bibbidi.wedding.user.controller;

import com.bibbidi.wedding.user.controller.dto.CreateUserRequest;
import com.bibbidi.wedding.user.controller.dto.CreateUserResponse;
import com.bibbidi.wedding.user.service.UserCreationResult;
import com.bibbidi.wedding.user.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/api/users")
    public ResponseEntity<CreateUserResponse> createUser(@Valid @RequestBody CreateUserRequest request) {
        UserCreationResult result = userService.createUser(request.nickname(), request.password());
        return ResponseEntity.status(HttpStatus.CREATED).body(CreateUserResponse.from(result));
    }
}
