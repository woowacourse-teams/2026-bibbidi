package com.bibbidi.wedding.user.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class UserTest {

    @Test
    @DisplayName("닉네임을 변경해도 사용자 ID와 로그인 아이디와 비밀번호 해시는 유지한다")
    void shouldKeepIdAndPasswordLoginIdAndPasswordHashWhenNicknameChanges() {
        User user = new User(1L, "current", "current", "password-hash");

        User changed = user.changeNickname("new-name");

        assertThat(changed)
                .extracting(User::id, User::nickname, User::passwordLoginId, User::passwordHash)
                .containsExactly(1L, "new-name", "current", "password-hash");
    }

    @Test
    @DisplayName("비밀번호 해시를 변경해도 사용자 ID와 닉네임과 로그인 아이디는 유지한다")
    void shouldKeepIdAndNicknameAndPasswordLoginIdWhenPasswordHashChanges() {
        User user = new User(1L, "current", "current", "current-hash");

        User changed = user.changePasswordHash("new-hash");

        assertThat(changed)
                .extracting(User::id, User::nickname, User::passwordLoginId, User::passwordHash)
                .containsExactly(1L, "current", "current", "new-hash");
    }
}
