package com.bibbidi.wedding.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.auth.persistence.JpaRefreshSessionRepository;
import com.bibbidi.wedding.auth.repository.RefreshSessionRepository;
import com.bibbidi.wedding.auth.token.RefreshTokenGenerator;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.user.service.UserService;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class JwtReissueConcurrencyIntegrationTest {

    private static final Long MISSING_USER_ID = 999L;

    private Long userId;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private RefreshSessionRepository refreshSessionRepository;

    @Autowired
    private RefreshTokenGenerator refreshTokenGenerator;

    @Autowired
    private JpaRefreshSessionRepository jpaRefreshSessionRepository;

    @Autowired
    private UserService userService;

    @BeforeEach
    void setUp() {
        userId = userService.createUser("race", "unused-password-hash").id();
    }

    @AfterEach
    void tearDown() {
        jpaRefreshSessionRepository.deleteAll();
        userService.delete(userId);
    }

    @Test
    @DisplayName("같은 Refresh Token으로 동시에 재발급을 요청하면 한 건만 성공한다")
    void shouldReissueOnlyOnceForConcurrentRequests() throws Exception {
        String refreshToken = refreshTokenGenerator.generate();
        refreshSessionRepository.save(
                userId, refreshTokenGenerator.hash(refreshToken), LocalDateTime.now().plusDays(30));

        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<Boolean> first = executor.submit(() -> tryReissue(refreshToken, ready, start));
            Future<Boolean> second = executor.submit(() -> tryReissue(refreshToken, ready, start));

            boolean allRequestsAreReady = ready.await(5, TimeUnit.SECONDS);
            start.countDown();
            assertThat(allRequestsAreReady).isTrue();

            List<Boolean> results = List.of(
                    first.get(10, TimeUnit.SECONDS),
                    second.get(10, TimeUnit.SECONDS)
            );

            assertThat(results).containsExactlyInAnyOrder(true, false);
        }
    }

    @Test
    @DisplayName("사용자 계정이 없는 Refresh 세션으로는 토큰을 재발급할 수 없다")
    void shouldRejectRefreshSessionWithoutUser() {
        String refreshToken = refreshTokenGenerator.generate();
        refreshSessionRepository.save(
                MISSING_USER_ID, refreshTokenGenerator.hash(refreshToken), LocalDateTime.now().plusDays(30));

        assertThatThrownBy(() -> jwtService.reissueTokens(refreshToken))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.AUTHENTICATION_FAILED);
    }

    private boolean tryReissue(String refreshToken, CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        start.await();
        try {
            jwtService.reissueTokens(refreshToken);
            return true;
        } catch (RuntimeException exception) {
            return false;
        }
    }
}
