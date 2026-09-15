package com.bibbidi.wedding.user.repository;

import static org.assertj.core.api.Assertions.assertThat;

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
@Import({UserRepository.class, UserMapper.class, WeddingDateRepository.class, WeddingDateMapper.class})
class WeddingDateRepositoryIntegrationTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private WeddingDateRepository weddingDateRepository;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("결혼 예정일을 설정하지 않은 사용자는 null을 조회한다")
    void shouldFindNullWhenWeddingDateIsNotSet() {
        User user = userRepository.create(new User(null, "Bibbidi", "password-hash"));

        WeddingDate weddingDate = weddingDateRepository.findByUserId(user.id());

        assertThat(weddingDate)
                .extracting(WeddingDate::userId, WeddingDate::date)
                .containsExactly(user.id(), null);
    }

    @Test
    @DisplayName("결혼 예정일만 변경하고 사용자 정보는 유지한다")
    void shouldUpdateOnlyWeddingDate() {
        User user = userRepository.create(new User(null, "Bibbidi", "password-hash"));

        weddingDateRepository.save(new WeddingDate(user.id(), LocalDate.of(2027, 5, 15)));
        WeddingDate updatedWeddingDate = weddingDateRepository.findByUserId(user.id());
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
        weddingDateRepository.save(new WeddingDate(user.id(), weddingDate));
        LocalDateTime previousUpdatedAt = LocalDateTime.of(2000, 1, 1, 0, 0);
        jdbcTemplate.update(
                "UPDATE users SET updated_at = ? WHERE id = ?",
                previousUpdatedAt,
                user.id()
        );
        entityManager.clear();

        WeddingDate sameWeddingDate = weddingDateRepository.findByUserId(user.id());
        weddingDateRepository.save(sameWeddingDate.changeDate(weddingDate));
        LocalDateTime updatedAt = jdbcTemplate.queryForObject(
                "SELECT updated_at FROM users WHERE id = ?",
                LocalDateTime.class,
                user.id()
        );

        assertThat(updatedAt).isAfter(previousUpdatedAt);
    }
}
