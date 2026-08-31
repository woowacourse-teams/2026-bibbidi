package com.bibbidi.wedding.checklist.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemRepository;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;

@SpringBootTest
@ActiveProfiles("test")
@Sql("/checklist-catalog-fixture.sql")
@Sql(scripts = "/checklist-catalog-cleanup.sql", executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD)
class ChecklistItemAdditionConcurrencyIntegrationTest {

    private static final Long OWNER_ID = 7L;
    private static final Long CHECKLIST_ID = 1000L;
    private static final Long CONTRACT_ITEM_ID = 100L;

    @Autowired
    private ChecklistService checklistService;

    @Autowired
    private JpaChecklistItemRepository jpaChecklistItemRepository;

    @Test
    @DisplayName("같은 준비 항목의 추가 요청이 동시에 와도 하나만 추가한다")
    void shouldAddOnlyOneItemForConcurrentRequests() throws Exception {
        // given
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        // when
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<Boolean> first = executor.submit(() -> tryAdd(ready, start));
            Future<Boolean> second = executor.submit(() -> tryAdd(ready, start));

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
        assertThat(jpaChecklistItemRepository.findByChecklistId(CHECKLIST_ID)).hasSize(1);
    }

    private boolean tryAdd(CountDownLatch ready, CountDownLatch start) throws InterruptedException {
        ready.countDown();
        start.await();

        try {
            checklistService.addItemsFromCatalog(OWNER_ID, List.of(CONTRACT_ITEM_ID));
            return true;
        } catch (BusinessException exception) {
            assertThat(exception.clientError()).isEqualTo(ClientError.DUPLICATE_CHECKLIST_ITEM);
            return false;
        }
    }
}
