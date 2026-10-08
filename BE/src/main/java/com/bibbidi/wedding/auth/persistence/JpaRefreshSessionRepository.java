package com.bibbidi.wedding.auth.persistence;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import com.bibbidi.wedding.auth.domain.ClientType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;

public interface JpaRefreshSessionRepository extends JpaRepository<JpaRefreshSessionEntity, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT session FROM JpaRefreshSessionEntity session WHERE session.tokenHash = :tokenHash")
    Optional<JpaRefreshSessionEntity> findByTokenHashForUpdate(@Param("tokenHash") String tokenHash);

    @Query("""
            SELECT session
              FROM JpaRefreshSessionEntity session
             WHERE session.userId = :userId
               AND session.clientType = :clientType
               AND session.revokedAt IS NULL
               AND session.rotatedAt IS NULL
               AND session.expiresAt > :now
             ORDER BY session.createdAt DESC
            """)
    Optional<JpaRefreshSessionEntity> findLatestUsableSession(
            @Param("userId") Long userId,
            @Param("clientType") ClientType clientType,
            @Param("now") LocalDateTime now);

    @Query("""
            SELECT COUNT(session) > 0
              FROM JpaRefreshSessionEntity session
             WHERE session.familyId = :familyId
               AND session.revokedAt IS NULL
               AND session.expiresAt > :now
            """)
    boolean existsUsableFamily(
            @Param("familyId") String familyId,
            @Param("now") LocalDateTime now);

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
