package com.bibbidi.wedding.auth.service;

public record AuthResult(
        Long userId,
        String nickname
) {
}
