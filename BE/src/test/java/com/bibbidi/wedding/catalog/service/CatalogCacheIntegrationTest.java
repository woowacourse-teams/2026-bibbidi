package com.bibbidi.wedding.catalog.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.catalog.config.CatalogCacheConfig;
import com.bibbidi.wedding.catalog.config.CatalogCacheProperties;
import com.bibbidi.wedding.catalog.controller.CatalogController;
import com.bibbidi.wedding.catalog.controller.dto.CatalogResponse;
import com.bibbidi.wedding.catalog.domain.Catalog;
import com.bibbidi.wedding.catalog.domain.Category;
import com.bibbidi.wedding.catalog.domain.Item;
import com.bibbidi.wedding.catalog.domain.Step;
import com.bibbidi.wedding.catalog.repository.CatalogMapper;
import com.bibbidi.wedding.catalog.repository.CatalogRepository;
import com.bibbidi.wedding.terms.config.TermsCacheProperties;
import com.bibbidi.wedding.terms.service.TermsResult;
import com.bibbidi.wedding.terms.service.TermsService;
import com.bibbidi.wedding.support.TestDatabaseLocks;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Ticker;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.persistence.EntityManagerFactory;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import javax.sql.DataSource;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.aop.support.AopUtils;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:catalog-cache-test;IGNORECASE=TRUE",
        "spring.jpa.properties.hibernate.generate_statistics=true",
        "bibbidi.catalog.cache.ttl=1m",
        "bibbidi.terms.cache.ttl=5m"
})
@ActiveProfiles("test")
@Sql({"/fixtures/catalog-fixture.sql", "/fixtures/terms-fixture.sql"})
@Sql(statements = {"DELETE FROM terms_agreements", "DELETE FROM terms", "DELETE FROM catalog_items",
        "DELETE FROM steps", "DELETE FROM categories"},
        executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD)
@ResourceLock(TestDatabaseLocks.SPRING_TEST)
class CatalogCacheIntegrationTest {

    @Autowired
    private CatalogService catalogService;

    @Autowired
    private CatalogController catalogController;

    @Autowired
    @Qualifier("catalogCacheManager")
    private CaffeineCacheManager catalogCacheManager;

    @Autowired
    @Qualifier("termsCacheManager")
    private CaffeineCacheManager termsCacheManager;

    @Autowired
    private TermsService termsService;

    @Autowired
    private TermsCacheProperties termsProperties;

    @Autowired
    private CatalogCacheProperties properties;

    @Autowired
    private MeterRegistry registry;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @MockitoBean(name = "catalogCacheTicker")
    private Ticker ticker;

    @MockitoBean(name = "termsCacheTicker")
    private Ticker termsTicker;

    @MockitoSpyBean
    private CatalogRepository catalogRepository;

    @MockitoSpyBean
    private CatalogMapper catalogMapper;

    @MockitoSpyBean
    private PlatformTransactionManager transactionManager;

    @MockitoSpyBean
    private DataSource dataSource;

    private final AtomicLong nanos = new AtomicLong();
    private final AtomicLong termsNanos = new AtomicLong();

    @BeforeEach
    void resetCacheAndObservations() {
        nanos.set(0);
        termsNanos.set(0);
        when(ticker.read()).thenAnswer(ignored -> nanos.get());
        when(termsTicker.read()).thenAnswer(ignored -> termsNanos.get());
        cache().invalidateAll();
        cache().cleanUp();
        termsCacheManager.getCache("terms").clear();
        statistics().clear();
        clearInvocations(catalogRepository, catalogMapper, transactionManager, dataSource);
    }

    @Test
    @DisplayName("첫 조회만 읽기 트랜잭션으로 세 테이블과 트리를 읽고 적중 시 연결도 열지 않는다")
    void shouldLoadOnlyOnMissWithoutOpeningTransactionOrConnectionOnHit() throws Exception {
        assertThat(AopUtils.isAopProxy(catalogService)).isTrue();
        doAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
            assertThat(TransactionSynchronizationManager.isCurrentTransactionReadOnly()).isTrue();
            return invocation.callRealMethod();
        }).when(catalogRepository).findCatalog();

        Catalog first = catalogService.find();

        assertThat(statistics().getPrepareStatementCount()).isEqualTo(3);
        assertThat(statistics().getTransactionCount()).isEqualTo(1);
        verify(dataSource).getConnection();
        verify(catalogRepository).findCatalog();
        verify(catalogMapper).toDomain(any(), any(), any());
        clearInvocations(transactionManager, dataSource, catalogRepository, catalogMapper);

        assertThat(catalogService.find()).isSameAs(first);
        assertThat(catalogService.find()).isSameAs(first);

        assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
        assertThat(statistics().getPrepareStatementCount()).isEqualTo(3);
        verifyNoInteractions(transactionManager, dataSource, catalogRepository, catalogMapper);
    }

    @Test
    @DisplayName("같은 인스턴스의 동시 첫 요청이 카탈로그를 한 번만 로드한다")
    void shouldCoalesceConcurrentFirstRequests() throws Exception {
        int callers = 8;
        CountDownLatch ready = new CountDownLatch(callers);
        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch requesting = new CountDownLatch(callers);
        CountDownLatch loading = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        doAnswer(invocation -> {
            loading.countDown();
            assertThat(release.await(10, TimeUnit.SECONDS)).isTrue();
            return invocation.callRealMethod();
        }).when(catalogRepository).findCatalog();

        try (var executor = Executors.newFixedThreadPool(callers)) {
            List<Future<Catalog>> results = new ArrayList<>();
            for (int i = 0; i < callers; i++) {
                results.add(executor.submit(() -> {
                    ready.countDown();
                    assertThat(start.await(10, TimeUnit.SECONDS)).isTrue();
                    requesting.countDown();
                    return catalogService.find();
                }));
            }
            try {
                assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
                start.countDown();
                assertThat(requesting.await(10, TimeUnit.SECONDS)).isTrue();
                assertThat(loading.await(10, TimeUnit.SECONDS)).isTrue();
            } finally {
                start.countDown();
                release.countDown();
            }
            Catalog first = results.getFirst().get(10, TimeUnit.SECONDS);
            for (Future<Catalog> result : results) {
                assertThat(result.get(10, TimeUnit.SECONDS)).isSameAs(first);
            }
        }

        verify(catalogRepository).findCatalog();
        verify(catalogMapper).toDomain(any(), any(), any());
        assertThat(statistics().getTransactionCount()).isEqualTo(1);
        verify(dataSource).getConnection();
        assertThat(statistics().getPrepareStatementCount()).isEqualTo(3);
    }

    @Test
    @DisplayName("적중해도 쓰기 기준 만료 시각은 연장되지 않고 만료 후 변경 데이터를 읽는다")
    void shouldReloadChangedDataAfterWriteExpiry() {
        assertThat(properties.ttl()).isEqualTo(Duration.ofMinutes(1));
        Catalog first = catalogService.find();
        jdbcTemplate.update("UPDATE categories SET name = '변경된 웨딩홀' WHERE id = 2");
        nanos.set(properties.ttl().minusNanos(1).toNanos());

        assertThat(catalogService.find()).isSameAs(first);
        assertThat(first.categories().getFirst().name()).isEqualTo("웨딩홀");
        nanos.incrementAndGet();
        Catalog refreshed = catalogService.find();

        assertThat(refreshed).isNotSameAs(first);
        assertThat(refreshed.categories().getFirst().name()).isEqualTo("변경된 웨딩홀");
        verify(catalogRepository, times(2)).findCatalog();
        verify(catalogMapper, times(2)).toDomain(any(), any(), any());
    }

    @Test
    @DisplayName("조회 실패는 저장하지 않고 다음 요청에서 다시 로드한다")
    void shouldRetryAfterFailedLoad() {
        doThrow(new DataAccessResourceFailureException("catalog unavailable"))
                .doCallRealMethod().when(catalogRepository).findCatalog();

        assertThatThrownBy(catalogService::find).isInstanceOf(DataAccessResourceFailureException.class);
        assertThat(cache().estimatedSize()).isZero();
        assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();

        Catalog recovered = catalogService.find();
        assertThat(recovered.categories()).hasSize(2);
        assertThat(catalogService.find()).isSameAs(recovered);
        verify(catalogRepository, times(2)).findCatalog();
        verify(catalogMapper).toDomain(any(), any(), any());
    }

    @Test
    @DisplayName("캐시의 중첩 목록을 수정할 수 없고 응답과 모든 단계의 정렬을 유지한다")
    void shouldKeepNestedDataImmutableAndPreserveResponse() {
        Catalog cached = catalogService.find();
        Category category = cached.categories().getFirst();
        Step step = category.steps().getFirst();
        CatalogResponse firstResponse = catalogController.find();

        assertThatThrownBy(() -> cached.categories().clear()).isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> category.steps().clear()).isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> step.items().clear()).isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> firstResponse.categories().clear()).isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> firstResponse.categories().getFirst().steps().clear())
                .isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> firstResponse.categories().getFirst().steps().getFirst().items().clear())
                .isInstanceOf(UnsupportedOperationException.class);

        assertThat(catalogService.find()).isSameAs(cached);
        assertThat(catalogController.find()).isEqualTo(firstResponse);
        assertThat(cached.categories()).extracting(Category::id).containsExactly(2L, 1L);
        assertThat(category.steps()).extracting(Step::id).containsExactly(11L, 10L);
        assertThat(step.items()).extracting(Item::id).containsExactly(101L, 100L);
        assertThat(step.iconUrl()).isEqualTo("https://www.bibbidi.kr/icon/wedding/venue-hall-tour.png");
        assertThat(category.steps().getLast().description()).isNull();
        verify(catalogMapper).toDomain(any(), any(), any());
    }

    @Test
    @DisplayName("캐시된 공통 트리와 달리 다른 카탈로그 조회는 변경 데이터를 즉시 읽는다")
    void shouldNotCacheOtherCatalogQueries() {
        catalogService.find();
        catalogService.findItems(List.of(101L));
        catalogService.findAllItemDetails();
        catalogService.findCategoryNames(List.of(2L));
        jdbcTemplate.update("UPDATE catalog_items SET title = '변경된 견적 비교' WHERE id = 101");
        jdbcTemplate.update("UPDATE categories SET name = '변경된 웨딩홀' WHERE id = 2");

        assertThat(catalogService.findItems(List.of(101L)).getFirst().title()).isEqualTo("변경된 견적 비교");
        assertThat(catalogService.findAllItemDetails()).extracting(detail -> detail.title())
                .contains("변경된 견적 비교");
        assertThat(catalogService.findCategoryNames(List.of(2L)).nameOf(2L)).isEqualTo("변경된 웨딩홀");
        assertThat(catalogService.find().categories().getFirst().name()).isEqualTo("웨딩홀");
        verify(catalogRepository, times(2)).findItems(List.of(101L));
        verify(catalogRepository, times(2)).findAllItemDetails();
        verify(catalogRepository, times(2)).findCategoryNames(List.of(2L));
        verify(catalogRepository).findCatalog();
    }

    @Test
    @DisplayName("기존 MeterRegistry에서 카탈로그 적중과 미스 수를 구분한다")
    void shouldExposeHitAndMissMetrics() {
        double hits = requests("catalog", "hit");
        double misses = requests("catalog", "miss");
        double termsHits = requests("terms", "hit");
        double termsMisses = requests("terms", "miss");

        catalogService.find();
        catalogService.find();
        catalogService.find();
        termsService.findAll();
        termsService.findAll();

        assertThat(requests("catalog", "miss") - misses).isEqualTo(1);
        assertThat(requests("catalog", "hit") - hits).isEqualTo(2);
        assertThat(requests("terms", "miss") - termsMisses).isEqualTo(1);
        assertThat(requests("terms", "hit") - termsHits).isEqualTo(1);
    }

    @Test
    @DisplayName("같은 키를 사용해도 카탈로그와 약관은 각 TTL에 따라 독립적으로 갱신된다")
    void shouldRefreshCatalogAndTermsIndependently() {
        Catalog catalog = catalogService.find();
        List<TermsResult> terms = termsService.findAll();
        jdbcTemplate.update("UPDATE categories SET name = '변경된 웨딩홀' WHERE id = 2");
        jdbcTemplate.update("UPDATE terms SET title = '변경된 서비스 이용약관' WHERE id = 1");
        nanos.set(properties.ttl().toNanos());
        termsNanos.set(properties.ttl().toNanos());

        Catalog refreshedCatalog = catalogService.find();
        assertThat(refreshedCatalog).isNotSameAs(catalog);
        assertThat(refreshedCatalog.categories().getFirst().name()).isEqualTo("변경된 웨딩홀");
        assertThat(termsService.findAll()).isSameAs(terms);
        assertThat(terms).extracting(TermsResult::title).contains("서비스 이용약관");

        termsNanos.set(termsProperties.ttl().toNanos());
        List<TermsResult> refreshedTerms = termsService.findAll();
        assertThat(refreshedTerms).isNotSameAs(terms);
        assertThat(refreshedTerms).extracting(TermsResult::title).contains("변경된 서비스 이용약관");
        assertThat(catalogService.find()).isSameAs(refreshedCatalog);
    }

    private Cache<Object, Object> cache() {
        return ((CaffeineCache) catalogCacheManager.getCache(CatalogCacheConfig.CATALOG_CACHE)).getNativeCache();
    }

    private double requests(String cacheName, String result) {
        return registry.get("cache.gets").tags("cache", cacheName, "cache.manager", cacheName, "result", result)
                .functionCounter().count();
    }

    private Statistics statistics() {
        return entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
    }

}
