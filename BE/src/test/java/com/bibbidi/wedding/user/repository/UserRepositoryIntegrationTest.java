package com.bibbidi.wedding.user.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.domain.WeddingDate;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@ActiveProfiles("test")
@Import({UserRepository.class, UserMapper.class})
class UserRepositoryIntegrationTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("비밀번호 로그인 회원 중복 검사는 영문 대소문자를 구분하지 않는다")
    void shouldIgnoreCaseWhenCheckingPasswordLoginUser() {
        userRepository.create(new User(null, "Bibbidi", "hash-one"));

        assertThat(userRepository.existsPasswordLoginUserByNickname("bibbidi")).isTrue();
        assertThat(userRepository.existsPasswordLoginUserByNickname("Magic")).isFalse();
    }

    @Test
    @DisplayName("다른 비밀번호 로그인 회원이 쓰는 닉네임으로는 저장할 수 없다")
    void shouldRejectNicknameUsedByAnotherPasswordLoginUser() {
        userRepository.create(new User(null, "Bibbidi", "hash-one"));

        assertThatThrownBy(() -> userRepository.create(new User(null, "bibbidi", "hash-two")))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.DUPLICATE_NICKNAME);
    }

    @Test
    @DisplayName("다른 비밀번호 로그인 회원이 쓰는 닉네임으로는 변경할 수 없다")
    void shouldRejectNicknameChangeToOneUsedByAnotherPasswordLoginUser() {
        User currentUser = userRepository.create(new User(null, "Bibbidi", "hash-one"));
        userRepository.create(new User(null, "Magic", "hash-two"));

        assertThatThrownBy(() -> userRepository.update(currentUser.changeNickname("magic")))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.DUPLICATE_NICKNAME);
    }

    @Test
    @DisplayName("닉네임만 변경하고 사용자 ID와 비밀번호 해시는 유지한다")
    void shouldUpdateOnlyNickname() {
        LocalDate weddingDate = LocalDate.of(2027, 5, 15);
        User user = userRepository.create(new User(null, "Bibbidi", "password-hash"));
        userRepository.saveWeddingDate(new WeddingDate(user.id(), weddingDate));

        userRepository.update(user.changeNickname("bibbidi"));
        User updated = userRepository.findById(user.id());

        assertThat(updated.id()).isEqualTo(user.id());
        assertThat(updated.nickname()).isEqualTo("bibbidi");
        assertThat(updated.passwordHash()).isEqualTo("password-hash");
        assertThat(userRepository.findWeddingDateByUserId(user.id()).date()).isEqualTo(weddingDate);
        assertThat(userRepository.findPasswordLoginUserByNickname("BIBBIDI").nickname()).isEqualTo("bibbidi");
    }

    @Test
    @DisplayName("비밀번호 해시만 변경하고 사용자 ID와 닉네임은 유지한다")
    void shouldUpdateOnlyPasswordHash() {
        LocalDate weddingDate = LocalDate.of(2027, 5, 15);
        User user = userRepository.create(new User(null, "Bibbidi", "current-hash"));
        userRepository.saveWeddingDate(new WeddingDate(user.id(), weddingDate));

        userRepository.update(user.changePasswordHash("new-hash"));
        User updated = userRepository.findById(user.id());

        assertThat(updated.id()).isEqualTo(user.id());
        assertThat(updated.nickname()).isEqualTo("Bibbidi");
        assertThat(updated.passwordHash()).isEqualTo("new-hash");
        assertThat(userRepository.findWeddingDateByUserId(user.id()).date()).isEqualTo(weddingDate);
    }

    @Test
    @DisplayName("결혼 예정일을 설정하지 않은 사용자는 null을 조회한다")
    void shouldFindNullWhenWeddingDateIsNotSet() {
        User user = userRepository.create(new User(null, "Bibbidi", "password-hash"));

        WeddingDate weddingDate = userRepository.findWeddingDateByUserId(user.id());

        assertThat(weddingDate)
                .extracting(WeddingDate::userId, WeddingDate::date)
                .containsExactly(user.id(), null);
    }

    @Test
    @DisplayName("결혼 예정일만 변경하고 사용자 정보는 유지한다")
    void shouldUpdateOnlyWeddingDate() {
        User user = userRepository.create(new User(null, "Bibbidi", "password-hash"));

        userRepository.saveWeddingDate(new WeddingDate(user.id(), LocalDate.of(2027, 5, 15)));
        WeddingDate updatedWeddingDate = userRepository.findWeddingDateByUserId(user.id());
        User preservedUser = userRepository.findById(user.id());

        assertThat(updatedWeddingDate.date()).isEqualTo(LocalDate.of(2027, 5, 15));
        assertThat(preservedUser)
                .extracting(User::id, User::nickname, User::passwordHash)
                .containsExactly(user.id(), "Bibbidi", "password-hash");
    }

    @Test
    @DisplayName("동일한 결혼 예정일을 다시 저장해도 수정 시각을 갱신한다")
    void shouldUpdateTimestampWhenSameWeddingDateIsSaved() {
        LocalDate weddingDate = LocalDate.of(2027, 5, 15);
        User user = userRepository.create(new User(null, "Bibbidi", "password-hash"));
        userRepository.saveWeddingDate(new WeddingDate(user.id(), weddingDate));
        LocalDateTime previousUpdatedAt = LocalDateTime.of(2000, 1, 1, 0, 0);
        jdbcTemplate.update(
                "UPDATE users SET updated_at = ? WHERE id = ?",
                previousUpdatedAt,
                user.id()
        );
        entityManager.clear();

        WeddingDate sameWeddingDate = userRepository.findWeddingDateByUserId(user.id());
        userRepository.saveWeddingDate(sameWeddingDate.changeDate(weddingDate));
        LocalDateTime updatedAt = jdbcTemplate.queryForObject(
                "SELECT updated_at FROM users WHERE id = ?",
                LocalDateTime.class,
                user.id()
        );

        assertThat(updatedAt).isAfter(previousUpdatedAt);
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
