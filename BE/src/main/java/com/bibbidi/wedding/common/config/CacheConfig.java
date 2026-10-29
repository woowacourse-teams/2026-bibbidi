package com.bibbidi.wedding.common.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Ticker;
import java.time.Duration;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

@Configuration(proxyBeanMethods = false)
// 적중 시 트랜잭션을 열지 않도록 캐시 advice를 먼저 실행한다.
@EnableCaching(order = Ordered.LOWEST_PRECEDENCE - 1)
public class CacheConfig {

    public static CaffeineCacheManager singleEntryCacheManager(String cacheName, Duration ttl, Ticker ticker) {
        CaffeineCacheManager manager = new CaffeineCacheManager(cacheName);
        manager.setAllowNullValues(false);
        manager.setCaffeine(Caffeine.newBuilder()
                .maximumSize(1)
                .expireAfterWrite(ttl)
                .ticker(ticker)
                .recordStats());
        return manager;
    }
}
