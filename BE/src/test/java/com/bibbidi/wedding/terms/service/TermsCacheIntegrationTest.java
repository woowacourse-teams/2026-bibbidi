package com.bibbidi.wedding.terms.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.support.TestDatabaseLocks;
import com.bibbidi.wedding.terms.config.TermsCacheConfig;
import com.bibbidi.wedding.terms.config.TermsCacheProperties;
import com.bibbidi.wedding.terms.repository.TermsRepository;
import com.github.benmanes.caffeine.cache.Ticker;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.springframework.aop.support.AopUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.context.jdbc.Sql.ExecutionPhase;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:terms-cache-test;IGNORECASE=TRUE")
@ActiveProfiles("test")
@ResourceLock(TestDatabaseLocks.SPRING_TEST)
@Sql("/fixtures/terms-fixture.sql")
@Sql(statements = {"DELETE FROM terms_agreements", "DELETE FROM terms"}, executionPhase = ExecutionPhase.AFTER_TEST_METHOD)
class TermsCacheIntegrationTest {

    @Autowired
    private TermsService termsService;

    @Autowired
    private CaffeineCacheManager termsCacheManager;

    @Autowired
    private TermsCacheProperties properties;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private MeterRegistry meterRegistry;

    @MockitoSpyBean
    private TermsRepository termsRepository;

    @MockitoSpyBean
    private PlatformTransactionManager transactionManager;

    @MockitoSpyBean
    private DataSource dataSource;

    @MockitoBean(name = "termsCacheTicker")
    private Ticker ticker;

    private final AtomicLong elapsedNanos = new AtomicLong();

    @BeforeEach
    void setUp() {
        termsCacheManager.getCache(TermsCacheConfig.TERMS_CACHE).clear();
        elapsedNanos.set(0);
        when(ticker.read()).thenAnswer(invocation -> elapsedNanos.get());
        clearInvocations(termsRepository, transactionManager, dataSource);
    }

    @Test
    @DisplayName("실제 빈은 최초 조회만 읽기 트랜잭션과 DB 연결을 사용하고 적중 시 재사용한다")
    void shouldSkipRepositoryTransactionAndConnectionOnHit() throws Exception {
        assertThat(AopUtils.isAopProxy(termsService)).isTrue();
        assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
        doAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
            assertThat(TransactionSynchronizationManager.isCurrentTransactionReadOnly()).isTrue();
            return invocation.callRealMethod();
        }).when(termsRepository).findAll();

        List<TermsResult> first = termsService.findAll();
        verify(termsRepository).findAll();
        verify(transactionManager).getTransaction(argThat(definition ->
                definition.getName().equals(TermsService.class.getName() + ".findAll")));
        verify(dataSource).getConnection();
        clearInvocations(termsRepository, transactionManager, dataSource);

        assertThat(termsService.findAll()).isSameAs(first);
        assertThat(termsService.findAll()).isSameAs(first);
        verify(termsRepository, never()).findAll();
        verify(transactionManager, never()).getTransaction(any());
        verify(dataSource, never()).getConnection();
        verify(dataSource, never()).getConnection(any(), any());
        assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
    }

    @Test
    @DisplayName("동일 인스턴스의 동시 첫 조회는 한 번만 로드하고 대기 요청은 트랜잭션을 열지 않는다")
    void shouldLoadOnceForConcurrentMisses() throws Exception {
        int requestCount = 8;
        CountDownLatch ready = new CountDownLatch(requestCount);
        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch calling = new CountDownLatch(requestCount);
        CountDownLatch loading = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        doAnswer(invocation -> {
            loading.countDown();
            assertThat(release.await(10, TimeUnit.SECONDS)).isTrue();
            return invocation.callRealMethod();
        }).when(termsRepository).findAll();

        try (var executor = Executors.newFixedThreadPool(requestCount)) {
            List<Future<List<TermsResult>>> requests = new ArrayList<>();
            for (int i = 0; i < requestCount; i++) {
                requests.add(executor.submit(() -> {
                    ready.countDown();
                    assertThat(start.await(10, TimeUnit.SECONDS)).isTrue();
                    calling.countDown();
                    return termsService.findAll();
                }));
            }
            try {
                assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
                start.countDown();
                assertThat(calling.await(10, TimeUnit.SECONDS)).isTrue();
                assertThat(loading.await(10, TimeUnit.SECONDS)).isTrue();
            } finally {
                start.countDown();
                release.countDown();
            }
            List<TermsResult> first = requests.getFirst().get(10, TimeUnit.SECONDS);
            for (Future<List<TermsResult>> request : requests) {
                assertThat(request.get(10, TimeUnit.SECONDS)).isSameAs(first);
            }
        }
        verify(termsRepository).findAll();
        verify(transactionManager).getTransaction(argThat(definition ->
                definition.getName().equals(TermsService.class.getName() + ".findAll")));
        verify(dataSource).getConnection();
    }

    @Test
    @DisplayName("반복 적중해도 쓰기 기준 TTL이 연장되지 않고 만료 후 첫 요청이 변경된 약관을 읽는다")
    void shouldReloadAfterWriteExpirationWithoutSleeping() {
        List<TermsResult> first = termsService.findAll();
        jdbcTemplate.update("UPDATE terms SET version = 'v2', title = '새 약관' WHERE id = 1");

        elapsedNanos.set(properties.ttl().toNanos() - 1);
        assertThat(termsService.findAll()).isSameAs(first);
        verify(termsRepository).findAll();

        elapsedNanos.incrementAndGet();
        List<TermsResult> refreshed = termsService.findAll();
        assertThat(refreshed).extracting(TermsResult::id).containsExactly(1L, 2L, 3L);
        assertThat(refreshed.getFirst().version()).isEqualTo("v2");
        assertThat(refreshed.getFirst().title()).isEqualTo("새 약관");
        verify(termsRepository, times(2)).findAll();
    }

    @Test
    @DisplayName("실패한 조회는 저장하지 않고 다음 요청에서 재시도한다")
    void shouldRetryAfterLoadFailure() {
        doThrow(new DataAccessResourceFailureException("테스트 조회 실패"))
                .doCallRealMethod().when(termsRepository).findAll();

        assertThatThrownBy(termsService::findAll).isInstanceOf(DataAccessResourceFailureException.class);
        List<TermsResult> recovered = termsService.findAll();

        assertThat(recovered).hasSize(3);
        assertThat(termsService.findAll()).isSameAs(recovered);
        verify(termsRepository, times(2)).findAll();
    }

    @Test
    @DisplayName("캐시된 목록은 변경할 수 없고 변환 결과와 순서를 유지한다")
    void shouldKeepImmutableResultsInRepositoryOrder() {
        List<TermsResult> expected = termsRepository.findAll().stream().map(TermsResult::from).toList();
        List<TermsResult> cached = termsService.findAll();

        assertThat(cached).containsExactlyElementsOf(expected);
        assertThatThrownBy(() -> cached.add(expected.getFirst())).isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> cached.set(0, expected.getLast())).isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(cached::clear).isInstanceOf(UnsupportedOperationException.class);
        assertThat(termsService.findAll()).containsExactlyElementsOf(expected);
    }

    @Test
    @DisplayName("목록 캐시가 남아 있어도 동의 검증과 조회·저장은 DB의 최신 약관을 사용한다")
    void shouldNotCacheAgreementValidationOrHistory() {
        List<TermsResult> cached = termsService.findAll();
        jdbcTemplate.update("""
                INSERT INTO terms (id, code, version, title, content, required, created_at, updated_at)
                VALUES (4, 'NEW', 'v2', '새 필수 약관', '본문', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """);
        Long userId = 100L;

        assertThat(termsService.findAgreedTermsIds(userId)).isEmpty();
        assertThatThrownBy(() -> termsService.agree(userId, List.of(1L, 2L)))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.TERMS_AGREEMENT_REQUIRED);
        assertThat(termsService.findAgreedTermsIds(userId)).isEmpty();

        termsService.agree(userId, List.of(1L, 2L, 4L));
        assertThat(termsService.findAgreedTermsIds(userId)).containsExactlyInAnyOrder(1L, 2L, 4L);
        assertThat(termsService.findAgreedTermsIds(101L)).isEmpty();
        termsService.deleteAgreementsOf(userId);
        assertThat(termsService.findAgreedTermsIds(userId)).isEmpty();

        termsService.agree(userId, "v2");
        termsService.agree(userId, "v2");
        assertThat(termsService.findAgreedTermsIds(userId)).containsExactly(4L);
        termsService.moveAgreements(userId, 101L);
        assertThat(termsService.findAgreedTermsIds(userId)).isEmpty();
        assertThat(termsService.findAgreedTermsIds(101L)).containsExactly(4L);
        assertThat(termsService.findAll()).isSameAs(cached).hasSize(3);
    }

    @Test
    @DisplayName("기존 Actuator 레지스트리에 캐시 적중·미스 지표가 자동 등록된다")
    void shouldExposeCacheHitAndMissMetrics() {
        double hits = cacheGets("hit");
        double misses = cacheGets("miss");

        termsService.findAll();
        termsService.findAll();
        termsService.findAll();

        assertThat(cacheGets("hit") - hits).isEqualTo(2);
        assertThat(cacheGets("miss") - misses).isEqualTo(1);
    }

    private double cacheGets(String result) {
        return meterRegistry.get("cache.gets")
                .tags("cache", TermsCacheConfig.TERMS_CACHE, "cache.manager", "terms", "result", result)
                .functionCounter().count();
    }
}
