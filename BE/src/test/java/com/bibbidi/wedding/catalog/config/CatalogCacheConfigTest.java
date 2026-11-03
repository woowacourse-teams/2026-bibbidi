package com.bibbidi.wedding.catalog.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.cache.caffeine.CaffeineCacheManager;

class CatalogCacheConfigTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(CatalogCacheConfig.class)
            .withPropertyValues("bibbidi.catalog.cache.ttl=17s");

    @Test
    @DisplayName("설정한 TTL과 항목 하나 제한으로 카탈로그 캐시를 만든다")
    void shouldCreateCacheWithConfiguredTtlAndSingleEntry() {
        runner.run(context -> {
            assertThat(context).hasNotFailed();
            CaffeineCacheManager manager = context.getBean("catalogCacheManager", CaffeineCacheManager.class);
            assertThat(manager.getCacheNames()).containsExactly("catalog");
            CaffeineCache cache = (CaffeineCache) manager.getCache("catalog");
            assertThat(cache.getNativeCache().policy().expireAfterWrite().orElseThrow().getExpiresAfter())
                    .isEqualTo(Duration.ofSeconds(17));
            assertThat(cache.getNativeCache().policy().eviction().orElseThrow().getMaximum()).isEqualTo(1);
        });
    }

    @ParameterizedTest
    @ValueSource(strings = {"0s", "-1s", "61s", "2m"})
    @DisplayName("0 이하이거나 1분을 넘는 TTL은 시작 시 거부한다")
    void shouldRejectTtlOutOfRange(String ttl) {
        runner.withPropertyValues("bibbidi.catalog.cache.ttl=" + ttl)
                .run(context -> assertThat(context).hasFailed());
    }

    @Test
    @DisplayName("TTL은 1분까지 허용한다")
    void shouldAcceptOneMinuteTtl() {
        runner.withPropertyValues("bibbidi.catalog.cache.ttl=1m")
                .run(context -> assertThat(context).hasNotFailed());
    }
}
