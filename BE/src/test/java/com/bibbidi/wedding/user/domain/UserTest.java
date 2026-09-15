package com.bibbidi.wedding.user.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class UserTest {

    @Test
    @DisplayName("닉네임을 변경해도 사용자 ID와 비밀번호 해시는 유지한다")
    void shouldKeepIdAndPasswordHashWhenNicknameChanges() {
        LocalDate weddingDate = LocalDate.of(2027, 5, 15);
        User user = new User(1L, "current", "password-hash", weddingDate);

        User changed = user.changeNickname("new-name");

        assertThat(changed)
                .extracting(User::id, User::nickname, User::passwordHash, User::weddingDate)
                .containsExactly(1L, "new-name", "password-hash", weddingDate);
    }

    @Test
    @DisplayName("비밀번호 해시를 변경해도 사용자 ID와 닉네임은 유지한다")
    void shouldKeepIdAndNicknameWhenPasswordHashChanges() {
        LocalDate weddingDate = LocalDate.of(2027, 5, 15);
        User user = new User(1L, "current", "current-hash", weddingDate);

        User changed = user.changePasswordHash("new-hash");

        assertThat(changed)
                .extracting(User::id, User::nickname, User::passwordHash, User::weddingDate)
                .containsExactly(1L, "current", "new-hash", weddingDate);
    }

    @Test
    @DisplayName("결혼 예정일을 변경해도 사용자 ID와 닉네임, 비밀번호 해시는 유지한다")
    void shouldKeepUserInformationWhenWeddingDateChanges() {
        User user = new User(1L, "current", "password-hash", null);

        User changed = user.changeWeddingDate(LocalDate.of(2027, 5, 15));

        assertThat(changed)
                .extracting(User::id, User::nickname, User::passwordHash, User::weddingDate)
                .containsExactly(1L, "current", "password-hash", LocalDate.of(2027, 5, 15));
    }
}
