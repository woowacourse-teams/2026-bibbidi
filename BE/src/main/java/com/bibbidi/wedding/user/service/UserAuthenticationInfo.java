package com.bibbidi.wedding.user.service;

public record UserAuthenticationInfo(
        Long userId,
        String nickname,
        String passwordHash
) {
}
