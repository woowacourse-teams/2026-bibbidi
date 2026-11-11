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

import com.bibbidi.wedding.catalog.config.CatalogCacheConfig;
import com.bibbidi.wedding.catalog.controller.CatalogController;
import com.bibbidi.wedding.catalog.controller.dto.CatalogResponse;
import com.bibbidi.wedding.catalog.domain.Catalog;
import com.bibbidi.wedding.catalog.domain.Category;
import com.bibbidi.wedding.catalog.domain.Item;
import com.bibbidi.wedding.catalog.domain.Step;
import com.bibbidi.wedding.catalog.repository.CatalogMapper;
import com.bibbidi.wedding.catalog.repository.CatalogRepository;
import com.bibbidi.wedding.support.TestDatabaseLocks;
import com.github.benmanes.caffeine.cache.Cache;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.persistence.EntityManagerFactory;
import java.util.List;
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
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:catalog-cache-test;IGNORECASE=TRUE",
        "spring.jpa.properties.hibernate.generate_statistics=true"
})
@ActiveProfiles("test")
@Sql("/fixtures/catalog-fixture.sql")
@Sql(statements = {"DELETE FROM catalog_items", "DELETE FROM steps", "DELETE FROM categories"},
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
    private MeterRegistry registry;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @MockitoSpyBean
    private CatalogRepository catalogRepository;

    @MockitoSpyBean
    private CatalogMapper catalogMapper;

    @MockitoSpyBean
    private PlatformTransactionManager transactionManager;

    @MockitoSpyBean
    private DataSource dataSource;

    @BeforeEach
    void resetCacheAndObservations() {
        cache().invalidateAll();
        cache().cleanUp();
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
    @DisplayName("시간이 지나도 저장한 값을 유지하고 캐시가 비면 변경 데이터를 읽는다")
    void shouldKeepValueUntilCacheIsCleared() {
        Catalog first = catalogService.find();
        jdbcTemplate.update("UPDATE categories SET name = '변경된 웨딩홀' WHERE id = 2");

        assertThat(catalogService.find()).isSameAs(first);
        assertThat(cache().policy().expireAfterWrite()).isEmpty();
        assertThat(cache().policy().expireAfterAccess()).isEmpty();

        cache().invalidateAll();

        Catalog reloaded = catalogService.find();
        assertThat(reloaded.categories().getFirst().name()).isEqualTo("변경된 웨딩홀");
        verify(catalogRepository, times(2)).findCatalog();
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

        catalogService.find();
        catalogService.find();
        catalogService.find();

        assertThat(requests("catalog", "miss") - misses).isEqualTo(1);
        assertThat(requests("catalog", "hit") - hits).isEqualTo(2);
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
