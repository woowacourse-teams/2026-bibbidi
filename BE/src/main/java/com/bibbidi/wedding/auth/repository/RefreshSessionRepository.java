package com.bibbidi.wedding.auth.repository;

import com.bibbidi.wedding.auth.domain.RefreshSession;
import com.bibbidi.wedding.auth.persistence.JpaRefreshSessionRepository;
import com.bibbidi.wedding.auth.domain.ClientType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;

@Repository
public class RefreshSessionRepository {

    private final JpaRefreshSessionRepository jpaRefreshSessionRepository;
    private final AuthMapper authMapper;

    public RefreshSessionRepository(
            JpaRefreshSessionRepository jpaRefreshSessionRepository,
            AuthMapper authMapper
    ) {
        this.jpaRefreshSessionRepository = jpaRefreshSessionRepository;
        this.authMapper = authMapper;
    }

    public RefreshSession save(RefreshSession session) {
        return authMapper.toDomain(
                jpaRefreshSessionRepository.saveAndFlush(authMapper.toEntity(session))
        );
    }

    public Optional<RefreshSession> findByTokenHash(String tokenHash) {
        return jpaRefreshSessionRepository
                .findByTokenHash(tokenHash)
                .map(authMapper::toDomain);
    }

    public Optional<RefreshSession> findLatestUsableNativeSession(Long userId, LocalDateTime now) {
        return jpaRefreshSessionRepository
                .findLatestUsableSession(userId, ClientType.NATIVE, now)
                .map(authMapper::toDomain);
    }

    public boolean hasUsableFamily(String familyId, LocalDateTime now) {
        return jpaRefreshSessionRepository.existsUsableFamily(familyId, now);
    }

    public int revokeFamily(String familyId, LocalDateTime revokedAt) {
        return jpaRefreshSessionRepository.revokeFamily(familyId, revokedAt);
    }

    public int revokeAllOfUser(Long userId, LocalDateTime revokedAt) {
        return jpaRefreshSessionRepository.revokeAllOfUser(userId, revokedAt);
    }

    public int deleteExpiredOrRevoked(
            LocalDateTime now, LocalDateTime revokedThreshold, int batchSize) {
        List<Long> ids = jpaRefreshSessionRepository.findIdsToClean(
                now,
                revokedThreshold,
                PageRequest.of(0, batchSize)
        );
        jpaRefreshSessionRepository.deleteAllByIdInBatch(ids);
        return ids.size();
    }
}
