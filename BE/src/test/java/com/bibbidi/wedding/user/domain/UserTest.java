package com.bibbidi.wedding.user.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class UserTest {

    @Test
    @DisplayName("닉네임을 변경해도 사용자 ID와 비밀번호 해시는 유지한다")
    void shouldKeepIdAndPasswordHashWhenNicknameChanges() {
        User user = new User(1L, "current", "password-hash");

        User changed = user.changeNickname("new-name");

        assertThat(changed)
                .extracting(User::id, User::nickname, User::passwordHash)
                .containsExactly(1L, "new-name", "password-hash");
    }

    @Test
    @DisplayName("비밀번호 해시를 변경해도 사용자 ID와 닉네임은 유지한다")
    void shouldKeepIdAndNicknameWhenPasswordHashChanges() {
        User user = new User(1L, "current", "current-hash");

        User changed = user.changePasswordHash("new-hash");

        assertThat(changed)
                .extracting(User::id, User::nickname, User::passwordHash)
                .containsExactly(1L, "current", "new-hash");
    }
}
