package com.bibbidi.wedding.user.controller.dto;

import com.bibbidi.wedding.user.service.NicknameAvailabilityResult;

public record NicknameAvailabilityResponse(
        String nickname,
        boolean available
) {

    public static NicknameAvailabilityResponse from(NicknameAvailabilityResult result) {
        return new NicknameAvailabilityResponse(result.nickname(), result.available());
    }
}
