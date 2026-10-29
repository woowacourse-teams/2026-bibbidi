package com.bibbidi.wedding.terms.config;

import com.bibbidi.wedding.common.config.CacheConfig;
import com.github.benmanes.caffeine.cache.Ticker;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(TermsCacheProperties.class)
public class TermsCacheConfig {

    public static final String TERMS_CACHE = "terms";

    @Bean
    Ticker termsCacheTicker() {
        return Ticker.systemTicker();
    }

    @Bean
    // 매니저가 추가되어도 기존 약관 매니저의 기본 선택을 유지한다.
    @Primary
    CaffeineCacheManager termsCacheManager(
            TermsCacheProperties properties,
            @Qualifier("termsCacheTicker") Ticker ticker
    ) {
        return CacheConfig.singleEntryCacheManager(TERMS_CACHE, properties.ttl(), ticker);
    }
}
