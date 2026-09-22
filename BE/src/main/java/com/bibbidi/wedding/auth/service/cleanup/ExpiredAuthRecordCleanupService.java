package com.bibbidi.wedding.auth.service.cleanup;

import com.bibbidi.wedding.auth.config.AuthCleanupProperties;
import com.bibbidi.wedding.auth.repository.HandoffCodeRepository;
import com.bibbidi.wedding.auth.repository.OidcAuthRequestRepository;
import com.bibbidi.wedding.auth.repository.RefreshSessionRepository;
import java.time.LocalDateTime;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 다 쓴 인증 기록을 지운다.
 *
 * <p>로그인을 시도할 때마다 인가 요청이 한 줄씩 쌓이고, WebView를 열 때마다 handoff code가 쌓인다.
 * 두지 않으면 유일 제약 인덱스가 계속 커진다.
 *
 * <p>이 작업이 멈춰도 인증은 정상 동작한다. 만료 판정은 조회할 때 하고 여기서는 정리만 하기 때문이다.
 * 한 번에 다 지우지 않고 정해진 수만큼 끊어 지운다. 운영 MySQL에서 큰 삭제 한 방은 락을 오래 잡는다.
 */
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

    public CleanupResult cleanUp() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime revokedThreshold = now.minus(properties.revokedSessionRetention());
        int batchSize = properties.batchSize();

        int authRequests = deleteInBatches(
                batch -> oidcAuthRequestRepository.deleteExpiredOrUsed(now, batch), batchSize);
        int handoffCodes = deleteInBatches(
                batch -> handoffCodeRepository.deleteExpiredOrUsed(now, batch), batchSize);
        int refreshSessions = deleteInBatches(
                batch -> refreshSessionRepository.deleteExpiredOrRevoked(now, revokedThreshold, batch),
                batchSize);

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

    /**
     * @param oidcAuthRequests 지운 인가 요청 수
     * @param handoffCodes 지운 handoff code 수
     * @param refreshSessions 지운 refresh 세션 수
     */
    public record CleanupResult(int oidcAuthRequests, int handoffCodes, int refreshSessions) {
    }
}
