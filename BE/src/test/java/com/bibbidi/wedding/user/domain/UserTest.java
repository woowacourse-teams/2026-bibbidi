package com.bibbidi.wedding.user.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class UserTest {

    @Test
    @DisplayName("닉네임을 변경해도 사용자 ID와 비밀번호 해시는 유지한다")
    void shouldKeepIdentityAndPasswordHashWhenChangingNickname() {
        User user = User.restore(1L, "Bibbidi", "password-hash");

        user.changeNickname("bibbidi");

        assertThat(user.id()).isEqualTo(1L);
        assertThat(user.nickname()).isEqualTo("bibbidi");
        assertThat(user.passwordHash()).isEqualTo("password-hash");
    }
}
