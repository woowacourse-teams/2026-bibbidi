package com.bibbidi.wedding.user.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.common.domain.UserStatus;
import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.domain.WeddingDate;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class UserRepositoryIntegrationTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("소셜에서 받은 닉네임이 겹쳐도 회원을 만든다")
    void shouldCreateUserEvenWhenNicknameIsDuplicated() {
        User first = userRepository.create(User.pending("Bibbidi", "first@bibbidi.kr"));
        User second = userRepository.create(User.pending("Bibbidi", "second@bibbidi.kr"));

        assertThat(second.id()).isNotEqualTo(first.id());
        assertThat(second.nickname()).isEqualTo("Bibbidi");
    }

    @Test
    @DisplayName("닉네임 사용 여부는 영문 대소문자를 구분하지 않는다")
    void shouldIgnoreCaseWhenCheckingNickname() {
        userRepository.create(User.pending("Bibbidi", null));

        assertThat(userRepository.existsByNickname("bibbidi")).isTrue();
        assertThat(userRepository.existsByNickname("Magic")).isFalse();
    }

    @Test
    @DisplayName("닉네임만 변경하고 사용자 ID와 가입 상태는 유지한다")
    void shouldChangeOnlyNickname() {
        User created = userRepository.create(User.pending("current", "current@bibbidi.kr"));

        User changed = userRepository.update(created.changeNickname("new-name"));

        assertThat(changed)
                .extracting(User::id, User::nickname, User::status, User::email)
                .containsExactly(created.id(), "new-name", UserStatus.PENDING, "current@bibbidi.kr");
    }

    @Test
    @DisplayName("활성화해도 사용자 ID와 닉네임은 유지한다")
    void shouldActivateUser() {
        User created = userRepository.create(User.pending("current", null));

        User activated = userRepository.update(created.activate());

        assertThat(activated)
                .extracting(User::id, User::nickname, User::status)
                .containsExactly(created.id(), "current", UserStatus.ACTIVE);
    }

    @Test
    @DisplayName("결혼 예정일을 설정하지 않은 사용자는 null을 조회한다")
    void shouldFindNullWeddingDate() {
        User created = userRepository.create(User.pending("current", null));

        WeddingDate weddingDate = userRepository.findWeddingDateByUserId(created.id());

        assertThat(weddingDate.date()).isNull();
    }

    @Test
    @DisplayName("결혼 예정일만 변경하고 사용자 정보는 유지한다")
    void shouldChangeOnlyWeddingDate() {
        User created = userRepository.create(User.pending("current", "current@bibbidi.kr"));

        userRepository.saveWeddingDate(
                userRepository.findWeddingDateByUserId(created.id()).changeDate(LocalDate.of(2027, 5, 15)));

        assertThat(userRepository.findWeddingDateByUserId(created.id()).date())
                .isEqualTo(LocalDate.of(2027, 5, 15));
        assertThat(userRepository.findById(created.id()))
                .extracting(User::nickname, User::status, User::email)
                .containsExactly("current", UserStatus.PENDING, "current@bibbidi.kr");
    }

    @Test
    @DisplayName("같은 결혼 예정일을 다시 저장해도 수정 시각을 갱신한다")
    void shouldUpdateTimestampWhenSameWeddingDateIsSaved() throws InterruptedException {
        User created = userRepository.create(User.pending("current", null));
        WeddingDate weddingDate = new WeddingDate(created.id(), LocalDate.of(2027, 5, 15));
        userRepository.saveWeddingDate(weddingDate);
        LocalDateTime before = updatedAt(created.id());

        Thread.sleep(10);
        userRepository.saveWeddingDate(weddingDate);

        assertThat(updatedAt(created.id())).isAfter(before);
    }

    private LocalDateTime updatedAt(Long userId) {
        return jdbcTemplate.queryForObject(
                "SELECT updated_at FROM users WHERE id = ?", LocalDateTime.class, userId);
    }

    @Test
    @DisplayName("사용자를 삭제하면 조회되지 않는다")
    void shouldDeleteUser() {
        User created = userRepository.create(User.pending("current", null));

        int deleted = userRepository.deleteById(created.id());

        assertThat(deleted).isOne();
        assertThat(userRepository.existsByNickname("current")).isFalse();
    }
}
