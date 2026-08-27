package com.bibbidi.wedding.user.service;

public record NicknameAvailabilityResult(
        String nickname,
        boolean available
) {
}
