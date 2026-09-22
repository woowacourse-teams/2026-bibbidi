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
