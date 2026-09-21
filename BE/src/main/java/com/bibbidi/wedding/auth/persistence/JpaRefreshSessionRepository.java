package com.bibbidi.wedding.auth.persistence;

import java.time.LocalDateTime;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JpaRefreshSessionRepository extends JpaRepository<JpaRefreshSessionEntity, Long> {

    @Query("select session.userId from JpaRefreshSessionEntity session where session.tokenHash = :tokenHash")
    Optional<Long> findUserIdByTokenHash(@Param("tokenHash") String tokenHash);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update JpaRefreshSessionEntity session
               set session.revokedAt = :now
             where session.tokenHash = :tokenHash
               and session.revokedAt is null
               and session.expiresAt > :now
            """)
    int revokeUsableSession(@Param("tokenHash") String tokenHash, @Param("now") LocalDateTime now);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from JpaRefreshSessionEntity session where session.userId = :userId")
    void deleteByUserId(@Param("userId") Long userId);
}
