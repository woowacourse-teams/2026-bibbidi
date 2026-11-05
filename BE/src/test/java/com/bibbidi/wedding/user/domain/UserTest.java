package com.bibbidi.wedding.user.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.common.domain.UserRole;
import com.bibbidi.wedding.common.domain.UserStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class UserTest {

    @Test
    @DisplayName("소셜 인증만 끝난 회원은 아직 서비스를 쓸 수 없는 상태다")
    void shouldCreatePendingUser() {
        User user = User.pending("current", "current@bibbidi.kr");

        assertThat(user)
                .extracting(User::id, User::nickname, User::status, User::email)
                .containsExactly(null, "current", UserStatus.PENDING, "current@bibbidi.kr");
        assertThat(user.isActive()).isFalse();
    }

    @Test
    @DisplayName("닉네임을 변경해도 사용자 ID와 가입 상태는 유지한다")
    void shouldKeepIdAndStatusWhenNicknameChanges() {
        User user = new User(1L, "current", UserStatus.ACTIVE, UserRole.NORMAL, "current@bibbidi.kr");

        User changed = user.changeNickname("new-name");

        assertThat(changed)
                .extracting(User::id, User::nickname, User::status, User::email)
                .containsExactly(1L, "new-name", UserStatus.ACTIVE, "current@bibbidi.kr");
    }

    @Test
    @DisplayName("활성화해도 사용자 ID와 닉네임은 유지한다")
    void shouldKeepIdAndNicknameWhenActivated() {
        User user = User.pending("current", null);

        User activated = user.activate();

        assertThat(activated.isActive()).isTrue();
        assertThat(activated)
                .extracting(User::nickname, User::email)
                .containsExactly("current", null);
    }
}
