package com.bibbidi.wedding.user.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.persistence.JpaUserRepository;
import com.bibbidi.wedding.user.repository.UserRepository;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class UserServiceConcurrencyIntegrationTest {

    private static final String NICKNAME = "bibbidi";
    private static final String PASSWORD_HASH = "password-hash";

    @Autowired
    private UserService userService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JpaUserRepository jpaUserRepository;

    @AfterEach
    void tearDown() {
        jpaUserRepository.deleteAll();
    }

    @Test
    @DisplayName("같은 닉네임의 회원가입 요청이 동시에 와도 한 명만 가입시킨다")
    void shouldRegisterOnlyOneUserForConcurrentRequests() throws Exception {
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<Boolean> first = executor.submit(() -> tryCreateUser(ready, start));
            Future<Boolean> second = executor.submit(() -> tryCreateUser(ready, start));

            boolean allRequestsAreReady = ready.await(5, TimeUnit.SECONDS);
            start.countDown();
            assertThat(allRequestsAreReady).isTrue();

            List<Boolean> results = List.of(
                    first.get(5, TimeUnit.SECONDS),
                    second.get(5, TimeUnit.SECONDS)
            );

            assertThat(results).containsExactlyInAnyOrder(true, false);
        }

        assertThat(jpaUserRepository.count()).isOne();
        assertThat(userRepository.findByNickname(NICKNAME).nickname()).isEqualTo(NICKNAME);
    }

    @Test
    @DisplayName("서로 다른 사용자가 같은 닉네임으로 동시에 변경해도 한 명만 변경시킨다")
    void shouldChangeNicknameForOnlyOneUserOnConcurrentRequests() throws Exception {
        User first = userRepository.save(new User(null, "first", PASSWORD_HASH));
        User second = userRepository.save(new User(null, "second", PASSWORD_HASH));
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<Boolean> firstChange = executor.submit(() -> tryChangeNickname(first.id(), ready, start));
            Future<Boolean> secondChange = executor.submit(() -> tryChangeNickname(second.id(), ready, start));

            boolean allRequestsAreReady = ready.await(5, TimeUnit.SECONDS);
            start.countDown();
            assertThat(allRequestsAreReady).isTrue();

            List<Boolean> results = List.of(
                    firstChange.get(5, TimeUnit.SECONDS),
                    secondChange.get(5, TimeUnit.SECONDS)
            );

            assertThat(results).containsExactlyInAnyOrder(true, false);
        }

        assertThat(userRepository.findByNickname(NICKNAME).id()).isIn(first.id(), second.id());
        assertThat(jpaUserRepository.count()).isEqualTo(2);
    }

    private boolean tryCreateUser(CountDownLatch ready, CountDownLatch start) throws InterruptedException {
        ready.countDown();
        start.await();

        try {
            userService.createUser(NICKNAME, PASSWORD_HASH);
            return true;
        } catch (BusinessException exception) {
            assertThat(exception.clientError()).isEqualTo(ClientError.DUPLICATE_NICKNAME);
            return false;
        }
    }

    private boolean tryChangeNickname(Long userId, CountDownLatch ready, CountDownLatch start)
            throws InterruptedException {
        ready.countDown();
        start.await();

        try {
            userService.changeNickname(userId, NICKNAME);
            return true;
        } catch (BusinessException exception) {
            assertThat(exception.clientError()).isEqualTo(ClientError.DUPLICATE_NICKNAME);
            return false;
        }
    }
}
