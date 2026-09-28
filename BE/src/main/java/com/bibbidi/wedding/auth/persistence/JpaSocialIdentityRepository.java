package com.bibbidi.wedding.auth.persistence;

import com.bibbidi.wedding.auth.domain.SocialProvider;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JpaSocialIdentityRepository extends JpaRepository<JpaSocialIdentityEntity, Long> {

    Optional<JpaSocialIdentityEntity> findByProviderAndProviderUserId(
            SocialProvider provider, String providerUserId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE JpaSocialIdentityEntity identity SET identity.userId = :newUserId WHERE identity.userId = :userId")
    int changeUserId(@Param("userId") Long userId, @Param("newUserId") Long newUserId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM JpaSocialIdentityEntity identity WHERE identity.userId = :userId")
    int deleteByUserId(@Param("userId") Long userId);
}
