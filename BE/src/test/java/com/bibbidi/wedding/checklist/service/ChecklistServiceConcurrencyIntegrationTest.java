package com.bibbidi.wedding.checklist.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.checklist.persistence.JpaChecklistRepository;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
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
class ChecklistServiceConcurrencyIntegrationTest {

    private static final Long OWNER_ID = 1L;

    @Autowired
    private ChecklistService checklistService;

    @Autowired
    private JpaChecklistRepository jpaChecklistRepository;

    @AfterEach
    void tearDown() {
        jpaChecklistRepository.deleteAll();
    }

    @Test
    @DisplayName("같은 사용자의 체크리스트 생성 요청이 동시에 와도 하나만 생성한다")
    void shouldCreateOnlyOneChecklistForConcurrentRequests() throws Exception {
        // given
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        // when
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<Boolean> first = executor.submit(() -> tryCreate(ready, start));
            Future<Boolean> second = executor.submit(() -> tryCreate(ready, start));

            boolean allRequestsAreReady = ready.await(5, TimeUnit.SECONDS);
            start.countDown();
            assertThat(allRequestsAreReady).isTrue();

            List<Boolean> results = List.of(
                    first.get(5, TimeUnit.SECONDS),
                    second.get(5, TimeUnit.SECONDS)
            );

            assertThat(results).containsExactlyInAnyOrder(true, false);
        }

        // then
        assertThat(jpaChecklistRepository.count()).isOne();
        assertThat(jpaChecklistRepository.findAll().getFirst().ownerId()).isEqualTo(OWNER_ID);
    }

    private boolean tryCreate(CountDownLatch ready, CountDownLatch start) throws InterruptedException {
        ready.countDown();
        start.await();

        try {
            checklistService.create(OWNER_ID);
            return true;
        } catch (BusinessException exception) {
            assertThat(exception.clientError()).isEqualTo(ClientError.DUPLICATE_CHECKLIST);
            return false;
        }
    }
}
