package com.bibbidi.wedding.catalog.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "bibbidi.catalog.cache")
public record CatalogCacheProperties(Duration ttl) {

    private static final Duration MAX_TTL = Duration.ofMinutes(1);

    public CatalogCacheProperties {
        if (ttl.isZero() || ttl.isNegative() || ttl.compareTo(MAX_TTL) > 0) {
            throw new IllegalArgumentException("카탈로그 캐시 TTL은 0보다 크고 1분 이하여야 합니다.");
        }
    }
}
