package com.bibbidi.wedding.terms.persistence;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JpaTermsAgreementRepository extends JpaRepository<JpaTermsAgreementEntity, Long> {

    List<JpaTermsAgreementEntity> findAllByUserId(Long userId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE JpaTermsAgreementEntity agreement SET agreement.userId = :newUserId WHERE agreement.userId = :userId")
    int changeUserId(@Param("userId") Long userId, @Param("newUserId") Long newUserId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM JpaTermsAgreementEntity agreement WHERE agreement.userId = :userId")
    int deleteByUserId(@Param("userId") Long userId);
}
