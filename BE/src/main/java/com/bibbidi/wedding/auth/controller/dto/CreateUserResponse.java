package com.bibbidi.wedding.auth.controller.dto;

import com.bibbidi.wedding.user.service.UserResult;

public record CreateUserResponse(
        long id,
        String nickname
) {

    public static CreateUserResponse from(UserResult result) {
        return new CreateUserResponse(result.id(), result.nickname());
    }
}
