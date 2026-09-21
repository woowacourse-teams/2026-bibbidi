package com.bibbidi.wedding.user.controller.dto;

import com.bibbidi.wedding.user.service.PasswordLoginIdAvailabilityResult;

public record NicknameAvailabilityResponse(
        String nickname,
        boolean available
) {

    public static NicknameAvailabilityResponse from(PasswordLoginIdAvailabilityResult result) {
        return new NicknameAvailabilityResponse(result.passwordLoginId(), result.available());
    }
}
