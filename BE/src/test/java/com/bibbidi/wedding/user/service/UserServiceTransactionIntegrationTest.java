package com.bibbidi.wedding.user.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class UserServiceTransactionIntegrationTest {

    @Autowired
    private UserService userService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("체크리스트 생성에 실패하면 사용자 생성도 롤백한다")
    void shouldRollbackUserWhenChecklistCreationFails() {
        jdbcTemplate.execute("""
                ALTER TABLE checklists
                ADD CONSTRAINT reject_checklist_insert CHECK (id < 0)
                """);

        assertThatThrownBy(() -> userService.createUser("rollback", "wish"))
                .isInstanceOf(DataIntegrityViolationException.class);

        assertThat(userRepository.findByNickname("rollback")).isEmpty();
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM checklists", Long.class)).isZero();
    }
}
