package com.bibbidi.wedding.auth.persistence;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JpaOidcAuthRequestRepository extends JpaRepository<JpaOidcAuthRequestEntity, Long> {

    Optional<JpaOidcAuthRequestEntity> findByStateHash(String stateHash);

    @Query("""
            SELECT request.id
              FROM JpaOidcAuthRequestEntity request
             WHERE request.expiresAt < :threshold
                OR request.usedAt IS NOT NULL
            """)
    List<Long> findIdsToClean(@Param("threshold") LocalDateTime threshold, Pageable pageable);
}
