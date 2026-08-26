package com.bibbidi.wedding.user.authentication;

public record AuthenticatedUser(
        Long userId,
        String nickname
) {
}
