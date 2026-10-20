package com.bibbidi.wedding.auth.persistence;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JpaHandoffCodeRepository extends JpaRepository<JpaHandoffCodeEntity, Long> {

    Optional<JpaHandoffCodeEntity> findByCodeHash(String codeHash);

    @Query("""
            SELECT code.id
              FROM JpaHandoffCodeEntity code
             WHERE code.expiresAt < :threshold
                OR code.usedAt IS NOT NULL
            """)
    List<Long> findIdsToClean(@Param("threshold") LocalDateTime threshold, Pageable pageable);
}
