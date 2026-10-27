package com.bibbidi.wedding.terms.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "bibbidi.terms.cache")
public record TermsCacheProperties(Duration ttl) {

    public TermsCacheProperties {
        if (ttl.isZero() || ttl.isNegative()) {
            throw new IllegalArgumentException("약관 캐시 TTL은 0보다 커야 합니다.");
        }
    }
}
