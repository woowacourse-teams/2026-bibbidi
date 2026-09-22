package com.bibbidi.wedding.auth.service.withdrawal;

import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.auth.repository.RefreshSessionRepository;
import com.bibbidi.wedding.auth.repository.SocialIdentityRepository;
import com.bibbidi.wedding.auth.service.login.SocialLoginService;
import com.bibbidi.wedding.auth.token.BibbidiTokenIssuer;
import com.bibbidi.wedding.auth.token.BibbidiTokenParser;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.terms.service.TermsService;
import com.bibbidi.wedding.user.service.UserService;
import java.time.LocalDateTime;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 탈퇴를 맡는다.
 *
 * <p>access token만으로는 탈퇴시키지 않는다. 소셜로 한 번 더 인증해 받은 표를 함께 내야 한다.
 * 토큰을 훔친 쪽이 계정을 지워 버리는 일을 막기 위해서다.
 */
@Service
@Transactional
public class WithdrawalService {

    private final SocialLoginService socialLoginService;
    private final BibbidiTokenIssuer bibbidiTokenIssuer;
    private final BibbidiTokenParser bibbidiTokenParser;
    private final SocialIdentityRepository socialIdentityRepository;
    private final RefreshSessionRepository refreshSessionRepository;
    private final TermsService termsService;
    private final UserService userService;

    public WithdrawalService(
            SocialLoginService socialLoginService,
            BibbidiTokenIssuer bibbidiTokenIssuer,
            BibbidiTokenParser bibbidiTokenParser,
            SocialIdentityRepository socialIdentityRepository,
            RefreshSessionRepository refreshSessionRepository,
            TermsService termsService,
            UserService userService
    ) {
        this.socialLoginService = socialLoginService;
        this.bibbidiTokenIssuer = bibbidiTokenIssuer;
        this.bibbidiTokenParser = bibbidiTokenParser;
        this.socialIdentityRepository = socialIdentityRepository;
        this.refreshSessionRepository = refreshSessionRepository;
        this.termsService = termsService;
        this.userService = userService;
    }

    /** 소셜 재인증이 끝나면 수명이 짧은 탈퇴용 표를 내준다. */
    public String issueDeleteGrant(
            SocialProvider provider,
            ClientType clientType,
            String code,
            String state,
            @Nullable String browserBinder,
            Long currentUserId
    ) {
        Long verifiedUserId = socialLoginService.verifyForWithdrawal(
                provider, clientType, code, state, browserBinder, currentUserId);
        return bibbidiTokenIssuer.issueDeleteGrant(verifiedUserId);
    }

    public void withdraw(Long currentUserId, String deleteGrant) {
        Long grantedUserId = bibbidiTokenParser.parseDeleteGrant(deleteGrant);
        if (!grantedUserId.equals(currentUserId)) {
            throw new BusinessException(ClientError.DELETE_GRANT_INVALID,
                    "탈퇴 표가 지금 로그인한 회원의 것이 아닙니다.");
        }

        refreshSessionRepository.revokeAllOfUser(currentUserId, LocalDateTime.now());
        socialIdentityRepository.deleteByUserId(currentUserId);
        termsService.deleteAgreementsOf(currentUserId);
        userService.delete(currentUserId);
    }
}
