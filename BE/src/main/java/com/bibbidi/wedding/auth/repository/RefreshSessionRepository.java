package com.bibbidi.wedding.auth.repository;

import com.bibbidi.wedding.auth.persistence.JpaRefreshSessionEntity;
import com.bibbidi.wedding.auth.persistence.JpaRefreshSessionRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.springframework.stereotype.Repository;

@Repository
public class RefreshSessionRepository {

    private static final int REVOKED_ONE_SESSION = 1;

    private final JpaRefreshSessionRepository jpaRefreshSessionRepository;

    public RefreshSessionRepository(JpaRefreshSessionRepository jpaRefreshSessionRepository) {
        this.jpaRefreshSessionRepository = jpaRefreshSessionRepository;
    }

    public void save(Long userId, String tokenHash, LocalDateTime expiresAt) {
        jpaRefreshSessionRepository.save(new JpaRefreshSessionEntity(userId, tokenHash, expiresAt));
    }

    public Optional<Long> findUserIdByTokenHash(String tokenHash) {
        return jpaRefreshSessionRepository.findUserIdByTokenHash(tokenHash);
    }

    public boolean revokeUsableSession(String tokenHash, LocalDateTime now) {
        return jpaRefreshSessionRepository.revokeUsableSession(tokenHash, now) == REVOKED_ONE_SESSION;
    }

    public void deleteByUserId(Long userId) {
        jpaRefreshSessionRepository.deleteByUserId(userId);
    }
}
