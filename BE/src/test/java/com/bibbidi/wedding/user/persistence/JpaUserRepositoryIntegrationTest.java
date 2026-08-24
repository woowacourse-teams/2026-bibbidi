package com.bibbidi.wedding.user.persistence;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.exception.DuplicateNicknameException;
import com.bibbidi.wedding.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class JpaUserRepositoryIntegrationTest {

    @Autowired
    private UserRepository userRepository;

    @Test
    void mapsDatabaseNicknameConstraintToConflict() {
        userRepository.save(User.create("same-name", "hash-one"));

        assertThatThrownBy(() -> userRepository.save(User.create("same-name", "hash-two")))
                .isInstanceOf(DuplicateNicknameException.class);
    }
}
