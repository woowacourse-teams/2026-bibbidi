package com.bibbidi.wedding.catalog.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.common.config.CacheConfig;
import com.bibbidi.wedding.terms.config.TermsCacheConfig;
import java.time.Duration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.cache.caffeine.CaffeineCacheManager;

class CatalogCacheConfigTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(CacheConfig.class, TermsCacheConfig.class, CatalogCacheConfig.class)
            .withPropertyValues("bibbidi.terms.cache.ttl=5m", "bibbidi.catalog.cache.ttl=17s");

    @Test
    @DisplayName("공통 설정을 사용해도 캐시별 TTL과 저장 영역은 분리된다")
    void shouldKeepIndependentTtlAndStorage() {
        runner.run(context -> {
            assertThat(context).hasNotFailed();
            CaffeineCacheManager catalog = context.getBean("catalogCacheManager", CaffeineCacheManager.class);
            CaffeineCacheManager terms = context.getBean("termsCacheManager", CaffeineCacheManager.class);
            assertThat(catalog.getCacheNames()).containsExactly("catalog");
            assertThat(terms.getCacheNames()).containsExactly("terms");
            CaffeineCache catalogCache = (CaffeineCache) catalog.getCache("catalog");
            CaffeineCache termsCache = (CaffeineCache) terms.getCache("terms");
            assertThat(catalogCache.getNativeCache().policy().expireAfterWrite().orElseThrow().getExpiresAfter())
                    .isEqualTo(Duration.ofSeconds(17));
            assertThat(termsCache.getNativeCache().policy().expireAfterWrite().orElseThrow().getExpiresAfter())
                    .isEqualTo(Duration.ofMinutes(5));
            catalogCache.put("all", "catalog result");
            termsCache.put("all", "terms result");
            assertThat(catalogCache.get("all", String.class)).isEqualTo("catalog result");
            assertThat(termsCache.get("all", String.class)).isEqualTo("terms result");
        });
    }

    @ParameterizedTest
    @ValueSource(strings = {"0s", "-1s"})
    @DisplayName("0 이하의 TTL은 시작 시 거부한다")
    void shouldRejectNonPositiveTtl(String ttl) {
        runner.withPropertyValues("bibbidi.catalog.cache.ttl=" + ttl)
                .run(context -> assertThat(context).hasFailed());
    }

    @Test
    @DisplayName("카탈로그 매니저를 추가해도 기존 기본 매니저는 약관 매니저다")
    void shouldPreserveExistingDefaultCacheManager() {
        runner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context.getBeansOfType(CacheManager.class)).hasSize(2);
            assertThat(context.getBean(CacheManager.class)).isSameAs(context.getBean("termsCacheManager"));
        });
    }
}
