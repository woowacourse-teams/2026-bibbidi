package com.bibbidi.wedding.auth.service;

import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.auth.repository.RefreshSessionRepository;
import com.bibbidi.wedding.auth.repository.SocialIdentityRepository;
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

    public String issueDeleteGrantToken(
            SocialProvider provider,
            ClientType clientType,
            String code,
            String state,
            @Nullable String browserBinder,
            Long currentUserId
    ) {
        Long verifiedUserId = socialLoginService.verifyForWithdrawal(
                provider,
                clientType,
                code,
                state,
                browserBinder,
                currentUserId
        );
        return bibbidiTokenIssuer.issueDeleteGrantToken(verifiedUserId);
    }

    public void withdraw(Long currentUserId, String deleteGrant) {
        Long grantedUserId = bibbidiTokenParser.parseDeleteGrantToken(deleteGrant);
        if (!grantedUserId.equals(currentUserId)) {
            throw new BusinessException(
                    ClientError.DELETE_GRANT_INVALID,
                    "탈퇴 표가 지금 로그인한 회원의 것이 아닙니다."
            );
        }

        refreshSessionRepository.revokeAllOfUser(currentUserId, LocalDateTime.now());
        socialIdentityRepository.deleteByUserId(currentUserId);
        termsService.deleteAgreementsOf(currentUserId);
        userService.delete(currentUserId);
    }
}
