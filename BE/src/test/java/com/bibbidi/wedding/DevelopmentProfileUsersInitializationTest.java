package com.bibbidi.wedding;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import com.bibbidi.wedding.common.domain.UserRole;
import com.bibbidi.wedding.common.domain.UserStatus;
import com.bibbidi.wedding.user.persistence.JpaUserEntity;
import com.bibbidi.wedding.user.persistence.JpaUserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest
@ActiveProfiles("dev")
@TestPropertySource(properties = "auth.jwt.secret=test-only-jwt-secret-value-for-bibbidi-auth")
class DevelopmentProfileUsersInitializationTest {

    @Autowired
    private JpaUserRepository userRepository;

    @Test
    void initializesFourPendingTestUsers() {
        assertThat(userRepository.findAll())
                .extracting(JpaUserEntity::nickname, JpaUserEntity::status, JpaUserEntity::role)
                .containsExactlyInAnyOrder(
                        tuple("보예", UserStatus.PENDING, UserRole.NORMAL),
                        tuple("티뉴", UserStatus.PENDING, UserRole.NORMAL),
                        tuple("바드", UserStatus.PENDING, UserRole.NORMAL),
                        tuple("라티", UserStatus.PENDING, UserRole.NORMAL));
    }
}
