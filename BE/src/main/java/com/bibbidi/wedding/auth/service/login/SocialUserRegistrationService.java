package com.bibbidi.wedding.auth.service.login;

import com.bibbidi.wedding.auth.domain.SocialIdentity;
import com.bibbidi.wedding.auth.oidc.idtoken.SocialUserIdentity;
import com.bibbidi.wedding.auth.repository.SocialIdentityRepository;
import com.bibbidi.wedding.auth.service.session.SessionOwner;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.user.service.UserResult;
import com.bibbidi.wedding.user.service.UserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 검증을 마친 소셜 신원으로 회원을 찾거나 만든다.
 *
 * <p>처음 보는 소셜 계정이면 회원을 만들되 약관에 동의하기 전이라 아직 서비스를 쓸 수 없는 상태로 둔다.
 * 이메일이 같다는 이유로 기존 회원에 붙이지 않는다.
 */
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

    public SessionOwner findOrCreate(SocialUserIdentity identity) {
        return socialIdentityRepository
                .findByProviderAndProviderUserId(identity.provider(), identity.providerUserId())
                .map(linked -> toOwner(userService.findCurrentUserInfo(linked.userId())))
                .orElseGet(() -> create(identity));
    }

    /** 이 소셜 계정에 연결된 회원을 찾는다. 연결돼 있지 않으면 거절한다. */
    public Long findLinkedUserId(SocialUserIdentity identity, ClientError errorWhenMissing) {
        return socialIdentityRepository
                .findByProviderAndProviderUserId(identity.provider(), identity.providerUserId())
                .map(SocialIdentity::userId)
                .orElseThrow(() -> new BusinessException(errorWhenMissing,
                        "이 소셜 계정은 회원과 연결돼 있지 않습니다. provider=" + identity.provider()));
    }

    /** 닉네임은 제공자에서 받은 값을 그대로 쓰고, 받지 못했으면 가입을 진행하지 않는다. */
    private SessionOwner create(SocialUserIdentity identity) {
        if (identity.nickname() == null || identity.nickname().isBlank()) {
            throw new BusinessException(ClientError.SOCIAL_NICKNAME_REQUIRED,
                    "소셜 계정에서 닉네임을 받지 못해 가입을 진행할 수 없습니다. provider=" + identity.provider());
        }

        UserResult created = userService.createPendingUser(identity.nickname(), identity.email());
        socialIdentityRepository.save(
                SocialIdentity.link(created.id(), identity.provider(), identity.providerUserId()));
        return toOwner(created);
    }

    private static SessionOwner toOwner(UserResult user) {
        return new SessionOwner(
                user.id(), user.status(), user.role(), user.nickname(), user.email());
    }
}
