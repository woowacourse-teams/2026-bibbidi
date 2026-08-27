package com.bibbidi.wedding.user.controller.dto;

import com.bibbidi.wedding.user.service.UserResult;

public record ChangeNicknameResponse(
        Long id,
        String nickname
) {

    public static ChangeNicknameResponse from(UserResult result) {
        return new ChangeNicknameResponse(result.id(), result.nickname());
    }
}
