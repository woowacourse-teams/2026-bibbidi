package com.bibbidi.wedding.catalog.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "bibbidi.catalog.cache")
public record CatalogCacheProperties(Duration ttl) {

    public CatalogCacheProperties {
        if (ttl.isZero() || ttl.isNegative()) {
            throw new IllegalArgumentException("카탈로그 캐시 TTL은 0보다 커야 합니다.");
        }
    }
}
