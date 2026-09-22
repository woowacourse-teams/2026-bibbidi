package com.bibbidi.wedding.auth.service.cleanup;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** 정리 작업을 정해진 시각에 돌린다. 도는 시각은 설정에서 온다. */
@Component
public class ExpiredAuthRecordCleanupScheduler {

    private final ExpiredAuthRecordCleanupService cleanupService;

    public ExpiredAuthRecordCleanupScheduler(ExpiredAuthRecordCleanupService cleanupService) {
        this.cleanupService = cleanupService;
    }

    @Scheduled(cron = "${auth.cleanup.cron}")
    public void cleanUp() {
        cleanupService.cleanUp();
    }
}
