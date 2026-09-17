package com.bibbidi.wedding.user.controller.dto;

import com.bibbidi.wedding.user.service.UserResult;

public record CurrentUserResponse(
        long id,
        String nickname
) {

    public static CurrentUserResponse from(UserResult result) {
        return new CurrentUserResponse(result.id(), result.nickname());
    }
}
