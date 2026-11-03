package com.bibbidi.wedding.catalog.config;

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
@EnableConfigurationProperties(CatalogCacheProperties.class)
@EnableCaching(order = Ordered.LOWEST_PRECEDENCE - 1)
public class CatalogCacheConfig {

    public static final String CATALOG_CACHE = "catalog";

    @Bean
    Ticker catalogCacheTicker() {
        return Ticker.systemTicker();
    }

    @Bean
    CaffeineCacheManager catalogCacheManager(
            CatalogCacheProperties properties,
            @Qualifier("catalogCacheTicker") Ticker ticker
    ) {
        CaffeineCacheManager manager = new CaffeineCacheManager(CATALOG_CACHE);
        manager.setAllowNullValues(false);
        manager.setCaffeine(Caffeine.newBuilder()
                .maximumSize(1)
                .expireAfterWrite(properties.ttl())
                .ticker(ticker)
                .recordStats());
        return manager;
    }
}
