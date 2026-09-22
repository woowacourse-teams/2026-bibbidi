package com.bibbidi.wedding.auth.service.cleanup;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.domain.HandoffCode;
import com.bibbidi.wedding.auth.domain.OidcAuthRequest;
import com.bibbidi.wedding.auth.domain.RefreshSession;
import com.bibbidi.wedding.auth.domain.SocialAuthPurpose;
import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.auth.repository.HandoffCodeRepository;
import com.bibbidi.wedding.auth.repository.OidcAuthRequestRepository;
import com.bibbidi.wedding.auth.repository.RefreshSessionRepository;
import java.time.LocalDateTime;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/** 스케줄러를 기다리지 않고 정리 서비스를 직접 불러 확인한다. */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ExpiredAuthRecordCleanupServiceIntegrationTest {

    private static final Long USER_ID = 1L;

    @Autowired
    private ExpiredAuthRecordCleanupService cleanupService;

    @Autowired
    private OidcAuthRequestRepository oidcAuthRequestRepository;

    @Autowired
    private HandoffCodeRepository handoffCodeRepository;

    @Autowired
    private RefreshSessionRepository refreshSessionRepository;

    @Test
    @DisplayName("만료됐거나 이미 쓴 인가 요청과 handoff code를 지운다")
    void shouldDeleteExpiredOrUsedRecords() {
        LocalDateTime now = LocalDateTime.now();
        oidcAuthRequestRepository.save(authRequest("expired-state", now.minusMinutes(1), null));
        oidcAuthRequestRepository.save(authRequest("used-state", now.plusMinutes(10), now));
        OidcAuthRequest alive =
                oidcAuthRequestRepository.save(authRequest("alive-state", now.plusMinutes(10), null));

        handoffCodeRepository.save(handoffCode("expired-code", now.minusSeconds(1), null));
        handoffCodeRepository.save(handoffCode("used-code", now.plusSeconds(60), now));
        HandoffCode aliveCode =
                handoffCodeRepository.save(handoffCode("alive-code", now.plusSeconds(60), null));

        ExpiredAuthRecordCleanupService.CleanupResult result = cleanupService.cleanUp();

        assertThat(result.oidcAuthRequests()).isEqualTo(2);
        assertThat(result.handoffCodes()).isEqualTo(2);
        assertThat(oidcAuthRequestRepository.findByStateHash(alive.stateHash())).isPresent();
        assertThat(handoffCodeRepository.findByCodeHash(aliveCode.codeHash())).isPresent();
    }

    @Test
    @DisplayName("살아 있는 refresh 세션은 지우지 않는다")
    void shouldKeepUsableRefreshSession() {
        LocalDateTime now = LocalDateTime.now();
        RefreshSession alive = refreshSessionRepository.save(RefreshSession.issue(
                USER_ID, UUID.randomUUID().toString(), ClientType.WEB, "alive-hash", now.plusDays(30)));
        refreshSessionRepository.save(RefreshSession.issue(
                USER_ID, UUID.randomUUID().toString(), ClientType.WEB, "expired-hash", now.minusDays(1)));

        ExpiredAuthRecordCleanupService.CleanupResult result = cleanupService.cleanUp();

        assertThat(result.refreshSessions()).isEqualTo(1);
        assertThat(refreshSessionRepository.findByTokenHash(alive.tokenHash())).isPresent();
        assertThat(refreshSessionRepository.findByTokenHash("expired-hash")).isEmpty();
    }

    @Test
    @DisplayName("지울 것이 없으면 아무것도 지우지 않는다")
    void shouldDeleteNothingWhenAllRecordsAreAlive() {
        ExpiredAuthRecordCleanupService.CleanupResult result = cleanupService.cleanUp();

        assertThat(result.oidcAuthRequests()).isZero();
        assertThat(result.handoffCodes()).isZero();
        assertThat(result.refreshSessions()).isZero();
    }

    private static OidcAuthRequest authRequest(
            String stateHash, LocalDateTime expiresAt, LocalDateTime usedAt) {
        return new OidcAuthRequest(
                null,
                stateHash,
                SocialProvider.KAKAO,
                "nonce",
                "code-verifier",
                null,
                ClientType.WEB,
                SocialAuthPurpose.LOGIN,
                expiresAt,
                usedAt);
    }

    private static HandoffCode handoffCode(
            String codeHash, LocalDateTime expiresAt, LocalDateTime usedAt) {
        return new HandoffCode(
                null, codeHash, USER_ID, UUID.randomUUID().toString(), expiresAt, usedAt);
    }
}
