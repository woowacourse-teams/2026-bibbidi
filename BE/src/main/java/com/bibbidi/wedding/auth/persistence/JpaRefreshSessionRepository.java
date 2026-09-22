package com.bibbidi.wedding.auth.persistence;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JpaRefreshSessionRepository extends JpaRepository<JpaRefreshSessionEntity, Long> {

    Optional<JpaRefreshSessionEntity> findByTokenHash(String tokenHash);

    /** 재사용이 감지되면 그 기기 계열에 딸린 세션을 한꺼번에 막는다. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            UPDATE JpaRefreshSessionEntity session
               SET session.revokedAt = :revokedAt
             WHERE session.familyId = :familyId
               AND session.revokedAt IS NULL
            """)
    int revokeFamily(@Param("familyId") String familyId, @Param("revokedAt") LocalDateTime revokedAt);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            UPDATE JpaRefreshSessionEntity session
               SET session.revokedAt = :revokedAt
             WHERE session.userId = :userId
               AND session.revokedAt IS NULL
            """)
    int revokeAllOfUser(@Param("userId") Long userId, @Param("revokedAt") LocalDateTime revokedAt);

    /**
     * 정리 대상 id를 먼저 뽑는다. 한 번에 다 지우면 운영 MySQL에서 락을 오래 잡는다.
     *
     * <p>만료된 세션은 더 쓸 수 없으므로 바로 지운다.
     * 폐기한 세션은 재사용을 감지한 흔적이라 얼마간 남겨 두었다가 지운다.
     */
    @Query("""
            SELECT session.id
              FROM JpaRefreshSessionEntity session
             WHERE session.expiresAt < :now
                OR session.revokedAt < :revokedThreshold
            """)
    List<Long> findIdsToClean(
            @Param("now") LocalDateTime now,
            @Param("revokedThreshold") LocalDateTime revokedThreshold,
            Pageable pageable);
}
