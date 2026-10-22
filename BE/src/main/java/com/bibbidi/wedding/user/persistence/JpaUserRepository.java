package com.bibbidi.wedding.user.persistence;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JpaUserRepository extends JpaRepository<JpaUserEntity, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<JpaUserEntity> findForUpdateById(Long userId);

    boolean existsByNicknameIgnoreCase(String nickname);

    boolean existsByNicknameIgnoreCaseAndIdNot(String nickname, Long id);

    Optional<JpaUserEntity> findByNicknameIgnoreCase(String nickname);

    Optional<JpaUserEntity> findByNicknameIgnoreCaseAndPasswordHashIsNotNull(String nickname);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE JpaUserEntity user SET user.passwordHash = NULL WHERE user.id = :userId")
    int removePasswordHashByUserId(@Param("userId") Long userId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM JpaUserEntity user WHERE user.id = :userId")
    int deleteByUserId(@Param("userId") Long userId);
}
