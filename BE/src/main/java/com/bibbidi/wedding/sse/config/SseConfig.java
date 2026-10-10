package com.bibbidi.wedding.sse.config;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class SseConfig {

    @Bean(destroyMethod = "shutdownNow")
    ExecutorService sseWorkerExecutor() {
        return Executors.newVirtualThreadPerTaskExecutor();
    }

    @Bean(destroyMethod = "shutdownNow")
    ScheduledThreadPoolExecutor sseTimeoutExecutor() {
        var executor = new ScheduledThreadPoolExecutor(2, Thread.ofPlatform().name("sse-timeout-", 0).factory());
        executor.setRemoveOnCancelPolicy(true);
        return executor;
    }
}
