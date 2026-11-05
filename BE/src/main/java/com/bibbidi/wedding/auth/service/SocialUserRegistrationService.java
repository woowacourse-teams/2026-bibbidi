package com.bibbidi.wedding.auth.service;

import com.bibbidi.wedding.auth.domain.SocialIdentity;
import com.bibbidi.wedding.auth.oidc.verification.VerifiedOidcUser;
import com.bibbidi.wedding.auth.repository.SocialIdentityRepository;
import com.bibbidi.wedding.auth.service.dto.UserAuthInfo;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.user.service.UserResult;
import com.bibbidi.wedding.user.service.UserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class SocialUserRegistrationService {

    private final SocialIdentityRepository socialIdentityRepository;
    private final UserService userService;

    public SocialUserRegistrationService(
            SocialIdentityRepository socialIdentityRepository,
            UserService userService
    ) {
        this.socialIdentityRepository = socialIdentityRepository;
        this.userService = userService;
    }

    public UserAuthInfo findOrCreate(VerifiedOidcUser identity) {
        return socialIdentityRepository
                .findByProviderAndProviderUserId(identity.provider(), identity.providerUserId())
                .map(linked -> toUserAuthInfo(
                        userService.findCurrentUserInfo(linked.userId())))
                .orElseGet(() -> create(identity));
    }

    public Long findLinkedUserId(VerifiedOidcUser identity, ClientError errorWhenMissing) {
        return socialIdentityRepository
                .findByProviderAndProviderUserId(identity.provider(), identity.providerUserId())
                .map(SocialIdentity::userId)
                .orElseThrow(() -> new BusinessException(
                        errorWhenMissing,
                        "연결된 소셜 계정이 회원과 연결되어 있지 않습니다. provider=" + identity.provider()));
    }

    private UserAuthInfo create(VerifiedOidcUser identity) {
        if (identity.nickname() == null || identity.nickname().isBlank()) {
            throw new BusinessException(
                    ClientError.SOCIAL_NICKNAME_REQUIRED,
                    "소셜 계정에서 닉네임을 받지 못해 가입을 진행할 수 없습니다. provider=" + identity.provider());
        }

        UserResult created = userService.createPendingUser(identity.nickname(), identity.email());
        socialIdentityRepository.save(
                SocialIdentity.link(
                        created.id(),
                        identity.provider(),
                        identity.providerUserId()
                )
        );
        return toUserAuthInfo(created);
    }

    private static UserAuthInfo toUserAuthInfo(UserResult user) {
        return new UserAuthInfo(
                user.id(),
                user.status(),
                user.role(),
                user.nickname(),
                user.email()
        );
    }
}
