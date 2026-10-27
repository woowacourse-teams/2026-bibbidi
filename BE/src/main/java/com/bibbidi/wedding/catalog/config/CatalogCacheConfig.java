package com.bibbidi.wedding.catalog.config;

import com.bibbidi.wedding.common.config.CacheConfig;
import com.github.benmanes.caffeine.cache.Ticker;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(CatalogCacheProperties.class)
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
        return CacheConfig.singleEntryCacheManager(CATALOG_CACHE, properties.ttl(), ticker);
    }
}
