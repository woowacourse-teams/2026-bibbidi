package com.bibbidi.wedding.user.controller.dto;

import com.bibbidi.wedding.user.service.NicknameChangeResult;

public record ChangeNicknameResponse(
        Long id,
        String nickname
) {

    public static ChangeNicknameResponse from(NicknameChangeResult result) {
        return new ChangeNicknameResponse(result.id(), result.nickname());
    }
}
