package com.bibbidi.wedding.user.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.domain.WeddingDate;
import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@ActiveProfiles("test")
@Import({UserRepository.class, UserMapper.class, WeddingDateRepository.class, WeddingDateMapper.class})
class UserRepositoryIntegrationTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private WeddingDateRepository weddingDateRepository;

    @Test
    @DisplayName("닉네임 중복 검사에서 현재 사용자는 제외하고 다른 사용자는 대소문자 없이 찾는다")
    void shouldIgnoreCaseAndExcludeCurrentUserWhenCheckingNickname() {
        User currentUser = userRepository.create(new User(null, "Bibbidi", "hash-one"));
        userRepository.create(new User(null, "Magic", "hash-two"));

        assertThat(userRepository.existsByNicknameExcludingUser("bibbidi", currentUser.id())).isFalse();
        assertThat(userRepository.existsByNicknameExcludingUser("MAGIC", currentUser.id())).isTrue();
    }

    @Test
    @DisplayName("닉네임만 변경하고 사용자 ID와 비밀번호 해시는 유지한다")
    void shouldUpdateOnlyNickname() {
        LocalDate weddingDate = LocalDate.of(2027, 5, 15);
        User user = userRepository.create(new User(null, "Bibbidi", "password-hash"));
        weddingDateRepository.save(new WeddingDate(user.id(), weddingDate));

        userRepository.update(user.changeNickname("bibbidi"));
        User updated = userRepository.findById(user.id());

        assertThat(updated.id()).isEqualTo(user.id());
        assertThat(updated.nickname()).isEqualTo("bibbidi");
        assertThat(updated.passwordHash()).isEqualTo("password-hash");
        assertThat(weddingDateRepository.findByUserId(user.id()).date()).isEqualTo(weddingDate);
        assertThat(userRepository.findByNickname("BIBBIDI").nickname()).isEqualTo("bibbidi");
    }

    @Test
    @DisplayName("비밀번호 해시만 변경하고 사용자 ID와 닉네임은 유지한다")
    void shouldUpdateOnlyPasswordHash() {
        LocalDate weddingDate = LocalDate.of(2027, 5, 15);
        User user = userRepository.create(new User(null, "Bibbidi", "current-hash"));
        weddingDateRepository.save(new WeddingDate(user.id(), weddingDate));

        userRepository.update(user.changePasswordHash("new-hash"));
        User updated = userRepository.findById(user.id());

        assertThat(updated.id()).isEqualTo(user.id());
        assertThat(updated.nickname()).isEqualTo("Bibbidi");
        assertThat(updated.passwordHash()).isEqualTo("new-hash");
        assertThat(weddingDateRepository.findByUserId(user.id()).date()).isEqualTo(weddingDate);
    }

    @Test
    @DisplayName("사용자를 삭제하면 같은 닉네임을 다시 저장할 수 있다")
    void shouldAllowNicknameReuseAfterDeletingUser() {
        User user = userRepository.create(new User(null, "Bibbidi", "password-hash"));

        int deletedCount = userRepository.deleteById(user.id());
        User registeredAgain = userRepository.create(new User(null, "bibbidi", "new-password-hash"));

        assertThat(deletedCount).isOne();
        assertThat(registeredAgain.id()).isNotEqualTo(user.id());
        assertThat(registeredAgain.nickname()).isEqualTo("bibbidi");
    }
}
