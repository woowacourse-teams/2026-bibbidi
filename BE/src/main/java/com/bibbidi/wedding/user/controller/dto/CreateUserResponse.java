package com.bibbidi.wedding.user.controller.dto;

import com.bibbidi.wedding.user.service.UserCreationResult;

public record CreateUserResponse(
        long id,
        String nickname
) {

    public static CreateUserResponse from(UserCreationResult result) {
        return new CreateUserResponse(result.id(), result.nickname());
    }
}
