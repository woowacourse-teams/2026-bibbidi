package com.bibbidi.wedding.auth.controller.dto;

import com.bibbidi.wedding.user.authentication.AuthenticatedUser;

public record LoginResponse(
        Long userId,
        String nickname
) {

    public static LoginResponse from(AuthenticatedUser result) {
        return new LoginResponse(result.userId(), result.nickname());
    }
}
