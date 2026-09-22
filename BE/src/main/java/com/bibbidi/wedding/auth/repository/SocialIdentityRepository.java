package com.bibbidi.wedding.auth.repository;

import com.bibbidi.wedding.auth.domain.SocialIdentity;
import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.auth.persistence.JpaSocialIdentityRepository;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.Optional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Repository;

@Repository
public class SocialIdentityRepository {

    private final JpaSocialIdentityRepository jpaSocialIdentityRepository;
    private final AuthMapper authMapper;

    public SocialIdentityRepository(
            JpaSocialIdentityRepository jpaSocialIdentityRepository,
            AuthMapper authMapper
    ) {
        this.jpaSocialIdentityRepository = jpaSocialIdentityRepository;
        this.authMapper = authMapper;
    }


    public SocialIdentity save(SocialIdentity identity) {
        try {
            return authMapper.toDomain(
                    jpaSocialIdentityRepository.saveAndFlush(authMapper.toEntity(identity))
            );
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(ClientError.DUPLICATE_SOCIAL_IDENTITY,
                    "이미 연결된 소셜 계정입니다. provider=" + identity.provider(), exception);
        }
    }

    public Optional<SocialIdentity> findByProviderAndProviderUserId(
            SocialProvider provider,
            String providerUserId
    ) {
        return jpaSocialIdentityRepository
                .findByProviderAndProviderUserId(provider, providerUserId)
                .map(authMapper::toDomain);
    }

    public int deleteByUserId(Long userId) {
        return jpaSocialIdentityRepository.deleteByUserId(userId);
    }
}
