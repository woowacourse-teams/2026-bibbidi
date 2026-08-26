package com.bibbidi.wedding.user.service;

import com.bibbidi.wedding.user.domain.User;

public record NicknameChangeResult(
        Long id,
        String nickname
) {

    public static NicknameChangeResult from(User user) {
        return new NicknameChangeResult(user.id(), user.nickname());
    }
}
