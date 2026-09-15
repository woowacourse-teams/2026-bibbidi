package com.bibbidi.wedding.user.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.user.domain.User;
import java.time.LocalDate;
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
        User currentUser = userRepository.save(new User(null, "Bibbidi", "hash-one", null));
        userRepository.save(new User(null, "Magic", "hash-two", null));

        assertThat(userRepository.existsByNicknameExcludingUser("bibbidi", currentUser.id())).isFalse();
        assertThat(userRepository.existsByNicknameExcludingUser("MAGIC", currentUser.id())).isTrue();
    }

    @Test
    @DisplayName("닉네임만 변경하고 사용자 ID와 비밀번호 해시는 유지한다")
    void shouldUpdateOnlyNickname() {
        LocalDate weddingDate = LocalDate.of(2027, 5, 15);
        User user = userRepository.save(new User(null, "Bibbidi", "password-hash", weddingDate));

        userRepository.save(user.changeNickname("bibbidi"));
        User updated = userRepository.findById(user.id());

        assertThat(updated.id()).isEqualTo(user.id());
        assertThat(updated.nickname()).isEqualTo("bibbidi");
        assertThat(updated.passwordHash()).isEqualTo("password-hash");
        assertThat(updated.weddingDate()).isEqualTo(weddingDate);
        assertThat(userRepository.findByNickname("BIBBIDI").nickname()).isEqualTo("bibbidi");
    }

    @Test
    @DisplayName("비밀번호 해시만 변경하고 사용자 ID와 닉네임은 유지한다")
    void shouldUpdateOnlyPasswordHash() {
        LocalDate weddingDate = LocalDate.of(2027, 5, 15);
        User user = userRepository.save(new User(null, "Bibbidi", "current-hash", weddingDate));

        userRepository.save(user.changePasswordHash("new-hash"));
        User updated = userRepository.findById(user.id());

        assertThat(updated.id()).isEqualTo(user.id());
        assertThat(updated.nickname()).isEqualTo("Bibbidi");
        assertThat(updated.passwordHash()).isEqualTo("new-hash");
        assertThat(updated.weddingDate()).isEqualTo(weddingDate);
    }

    @Test
    @DisplayName("결혼 예정일을 설정하지 않은 사용자는 null로 저장하고 조회한다")
    void shouldSaveAndFindUserWithoutWeddingDate() {
        User user = userRepository.save(new User(null, "Bibbidi", "password-hash", null));

        User found = userRepository.findById(user.id());

        assertThat(found.weddingDate()).isNull();
    }

    @Test
    @DisplayName("결혼 예정일만 변경하고 사용자 ID와 닉네임, 비밀번호 해시는 유지한다")
    void shouldUpdateOnlyWeddingDate() {
        User user = userRepository.save(new User(null, "Bibbidi", "password-hash", null));

        userRepository.save(user.changeWeddingDate(LocalDate.of(2027, 5, 15)));
        User updated = userRepository.findById(user.id());

        assertThat(updated)
                .extracting(User::id, User::nickname, User::passwordHash, User::weddingDate)
                .containsExactly(user.id(), "Bibbidi", "password-hash", LocalDate.of(2027, 5, 15));
    }

    @Test
    @DisplayName("사용자를 삭제하면 같은 닉네임을 다시 저장할 수 있다")
    void shouldAllowNicknameReuseAfterDeletingUser() {
        User user = userRepository.save(new User(null, "Bibbidi", "password-hash", null));

        int deletedCount = userRepository.deleteById(user.id());
        User registeredAgain = userRepository.save(new User(null, "bibbidi", "new-password-hash", null));

        assertThat(deletedCount).isOne();
        assertThat(registeredAgain.id()).isNotEqualTo(user.id());
        assertThat(registeredAgain.nickname()).isEqualTo("bibbidi");
    }
}
