package com.bibbidi.wedding.auth.service;

import com.bibbidi.wedding.auth.config.AuthCleanupProperties;
import com.bibbidi.wedding.auth.repository.HandoffCodeRepository;
import com.bibbidi.wedding.auth.repository.OidcAuthRequestRepository;
import com.bibbidi.wedding.auth.repository.RefreshSessionRepository;
import java.time.LocalDateTime;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@Transactional
public class ExpiredAuthRecordCleanupService {

    private final OidcAuthRequestRepository oidcAuthRequestRepository;
    private final HandoffCodeRepository handoffCodeRepository;
    private final RefreshSessionRepository refreshSessionRepository;
    private final AuthCleanupProperties properties;

    public ExpiredAuthRecordCleanupService(
            OidcAuthRequestRepository oidcAuthRequestRepository,
            HandoffCodeRepository handoffCodeRepository,
            RefreshSessionRepository refreshSessionRepository,
            AuthCleanupProperties properties
    ) {
        this.oidcAuthRequestRepository = oidcAuthRequestRepository;
        this.handoffCodeRepository = handoffCodeRepository;
        this.refreshSessionRepository = refreshSessionRepository;
        this.properties = properties;
    }

    @Scheduled(cron = "${auth.cleanup.cron}")
    public CleanupResult cleanUp() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime revokedThreshold = now.minus(properties.revokedSessionRetention());
        int batchSize = properties.batchSize();

        int authRequests = deleteInBatches(
                batch -> oidcAuthRequestRepository.deleteExpiredOrUsed(now, batch),
                batchSize
        );
        int handoffCodes = deleteInBatches(
                batch -> handoffCodeRepository.deleteExpiredOrUsed(now, batch),
                batchSize
        );
        int refreshSessions = deleteInBatches(
                batch -> refreshSessionRepository.deleteExpiredOrRevoked(now, revokedThreshold, batch),
                batchSize
        );

        CleanupResult result = new CleanupResult(authRequests, handoffCodes, refreshSessions);
        log.info("만료된 인증 기록을 정리했습니다. {}", result);
        return result;
    }

    private int deleteInBatches(BatchDeleter deleter, int batchSize) {
        int total = 0;
        for (int round = 0; round < properties.maxRoundsPerRun(); round++) {
            int deleted = deleter.delete(batchSize);
            total += deleted;
            if (deleted < batchSize) {
                break;
            }
        }
        return total;
    }

    @FunctionalInterface
    private interface BatchDeleter {
        int delete(int batchSize);
    }

    public record CleanupResult(int oidcAuthRequests, int handoffCodes, int refreshSessions) {
    }
}
