package com.bibbidi.wedding.user.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.user.domain.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@ActiveProfiles("test")
@Import({UserRepository.class, UserMapper.class})
class UserRepositoryIntegrationTest {

    @Autowired
    private UserRepository userRepository;

    @Test
    @DisplayName("닉네임 중복 검사에서 현재 사용자는 제외하고 다른 사용자는 대소문자 없이 찾는다")
    void shouldIgnoreCaseAndExcludeCurrentUserWhenCheckingNickname() {
        User currentUser = userRepository.save(User.create("Bibbidi", "hash-one"));
        userRepository.save(User.create("Magic", "hash-two"));

        assertThat(userRepository.existsByNicknameExcludingUser("bibbidi", currentUser.id())).isFalse();
        assertThat(userRepository.existsByNicknameExcludingUser("MAGIC", currentUser.id())).isTrue();
    }

    @Test
    @DisplayName("닉네임만 변경하고 사용자 ID와 비밀번호 해시는 유지한다")
    void shouldUpdateOnlyNickname() {
        User user = userRepository.save(User.create("Bibbidi", "password-hash"));

        userRepository.updateNickname(user.id(), "bibbidi");
        User updated = userRepository.findById(user.id());

        assertThat(updated.id()).isEqualTo(user.id());
        assertThat(updated.nickname()).isEqualTo("bibbidi");
        assertThat(updated.passwordHash()).isEqualTo("password-hash");
        assertThat(userRepository.findByNickname("BIBBIDI").nickname()).isEqualTo("bibbidi");
    }
}
