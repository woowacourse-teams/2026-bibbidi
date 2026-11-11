package com.bibbidi.wedding.catalog.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

@Configuration(proxyBeanMethods = false)
@EnableCaching(order = Ordered.LOWEST_PRECEDENCE - 1)
public class CatalogCacheConfig {

    public static final String CATALOG_CACHE = "catalog";

    @Bean
    CaffeineCacheManager catalogCacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager(CATALOG_CACHE);
        manager.setCaffeine(Caffeine.newBuilder().recordStats());
        return manager;
    }
}
