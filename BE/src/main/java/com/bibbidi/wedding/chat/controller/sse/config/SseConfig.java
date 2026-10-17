package com.bibbidi.wedding.chat.controller.sse.config;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(SseProperties.class)
public class SseConfig {

    @Bean(destroyMethod = "shutdownNow")
    ExecutorService sseVirtualThreadExecutor() {
        return Executors.newVirtualThreadPerTaskExecutor();
    }

    @Bean(destroyMethod = "shutdownNow")
    ScheduledThreadPoolExecutor sseTimeoutExecutor() {
        ScheduledThreadPoolExecutor executor = new ScheduledThreadPoolExecutor(
                2, Thread.ofPlatform().name("sse-timeout-", 0).factory());
        executor.setRemoveOnCancelPolicy(true);
        return executor;
    }
}
