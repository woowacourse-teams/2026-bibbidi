package com.bibbidi.wedding.auth.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.auth.persistence.JpaRefreshSessionEntity;
import com.bibbidi.wedding.auth.persistence.JpaRefreshSessionRepository;
import com.bibbidi.wedding.auth.token.RefreshTokenGenerator;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class RefreshSessionRepositoryTest {

    private static final Long USER_ID = 1L;

    @Autowired
    private RefreshSessionRepository refreshSessionRepository;

    @Autowired
    private JpaRefreshSessionRepository jpaRefreshSessionRepository;

    @Autowired
    private RefreshTokenGenerator refreshTokenGenerator;

    @Test
    @DisplayName("저장소에 Refresh Token 원본이 아니라 해시만 남는다")
    void shouldStoreOnlyHashedRefreshToken() {
        String refreshToken = refreshTokenGenerator.generate();

        refreshSessionRepository.save(
                USER_ID, refreshTokenGenerator.hash(refreshToken), LocalDateTime.now().plusDays(30));

        List<JpaRefreshSessionEntity> sessions = jpaRefreshSessionRepository.findAll();
        assertThat(sessions).hasSize(1);
        assertThat(sessions.getFirst().tokenHash())
                .isEqualTo(refreshTokenGenerator.hash(refreshToken))
                .isNotEqualTo(refreshToken);
    }

    @Test
    @DisplayName("만료된 Refresh 세션은 폐기 대상이 아니다")
    void shouldNotRevokeExpiredSession() {
        String tokenHash = refreshTokenGenerator.hash(refreshTokenGenerator.generate());
        refreshSessionRepository.save(USER_ID, tokenHash, LocalDateTime.now().minusMinutes(1));

        assertThat(refreshSessionRepository.revokeUsableSession(tokenHash, LocalDateTime.now())).isFalse();
    }

    @Test
    @DisplayName("이미 폐기한 Refresh 세션은 다시 폐기되지 않는다")
    void shouldNotRevokeAlreadyRevokedSession() {
        String tokenHash = refreshTokenGenerator.hash(refreshTokenGenerator.generate());
        refreshSessionRepository.save(USER_ID, tokenHash, LocalDateTime.now().plusDays(30));

        assertThat(refreshSessionRepository.revokeUsableSession(tokenHash, LocalDateTime.now())).isTrue();
        assertThat(refreshSessionRepository.revokeUsableSession(tokenHash, LocalDateTime.now())).isFalse();
    }

    @Test
    @DisplayName("저장하지 않은 해시로는 사용자를 찾지 못한다")
    void shouldNotFindUserIdForUnknownTokenHash() {
        assertThat(refreshSessionRepository.findUserIdByTokenHash("unknown-hash")).isEmpty();
    }
}
