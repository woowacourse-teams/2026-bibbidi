package com.bibbidi.wedding.chat.service;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import reactor.core.scheduler.Scheduler;
import reactor.core.scheduler.Schedulers;

@Configuration
public class ChatTurnArchiveConfig {

    private static final int THREAD_CAP = 3;
    private static final int QUEUED_TASK_CAP = 1000;

    @Bean(destroyMethod = "dispose")
    Scheduler chatTurnArchiveScheduler() {
        return Schedulers.newBoundedElastic(THREAD_CAP, QUEUED_TASK_CAP, "chat-turn-archive");
    }
}
