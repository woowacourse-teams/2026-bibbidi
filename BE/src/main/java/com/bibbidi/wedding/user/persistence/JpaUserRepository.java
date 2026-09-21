package com.bibbidi.wedding.user.persistence;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JpaUserRepository extends JpaRepository<JpaUserEntity, Long> {

    boolean existsByPasswordLoginIdIgnoreCase(String passwordLoginId);

    Optional<JpaUserEntity> findByPasswordLoginIdIgnoreCase(String passwordLoginId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM JpaUserEntity user WHERE user.id = :userId")
    int deleteByUserId(@Param("userId") Long userId);
}
