package com.bibbidi.wedding.user.service;

import com.bibbidi.wedding.user.domain.User;

public record UserResult(
        long id,
        String nickname
) {

    public static UserResult from(User user) {
        return new UserResult(user.id(), user.nickname());
    }
}
