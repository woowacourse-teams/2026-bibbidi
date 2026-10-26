package com.bibbidi.wedding.terms.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Ticker;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(TermsCacheProperties.class)
// 캐시 적중 시 트랜잭션을 열지 않도록 트랜잭션 advice보다 먼저 실행한다.
@EnableCaching(order = Ordered.LOWEST_PRECEDENCE - 1)
public class TermsCacheConfig {

    public static final String TERMS_CACHE = "terms";

    @Bean
    Ticker termsCacheTicker() {
        return Ticker.systemTicker();
    }

    @Bean
    CaffeineCacheManager termsCacheManager(
            TermsCacheProperties properties,
            @Qualifier("termsCacheTicker") Ticker ticker
    ) {
        CaffeineCacheManager manager = new CaffeineCacheManager(TERMS_CACHE);
        manager.setAllowNullValues(false);
        manager.setCaffeine(Caffeine.newBuilder()
                .maximumSize(1)
                .expireAfterWrite(properties.ttl())
                .ticker(ticker)
                .recordStats());
        return manager;
    }
}
