package com.bibbidi.wedding.auth.controller.dto;

import com.bibbidi.wedding.auth.service.AuthResult;

public record LoginResponse(
        Long userId,
        String nickname
) {

    public static LoginResponse from(AuthResult result) {
        return new LoginResponse(result.userId(), result.nickname());
    }
}
