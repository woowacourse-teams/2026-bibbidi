package com.bibbidi.wedding.auth.service;

import com.bibbidi.wedding.auth.token.BibbidiTokenClaims;
import com.bibbidi.wedding.auth.token.BibbidiTokenIssuer;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.terms.service.TermsService;
import com.bibbidi.wedding.user.service.UserResult;
import com.bibbidi.wedding.user.service.UserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class TermsAgreementService {

    private final TermsService termsService;
    private final UserService userService;
    private final BibbidiTokenIssuer bibbidiTokenIssuer;

    public TermsAgreementService(
            TermsService termsService,
            UserService userService,
            BibbidiTokenIssuer bibbidiTokenIssuer
    ) {
        this.termsService = termsService;
        this.userService = userService;
        this.bibbidiTokenIssuer = bibbidiTokenIssuer;
    }

    public String agree(Long currentUserId, String termsVersion, boolean agreed) {
        if (!agreed) {
            throw new BusinessException(
                    ClientError.INVALID_REQUEST,
                    "약관에 동의해야 가입을 완료할 수 있습니다.");
        }
        termsService.agree(currentUserId, termsVersion);
        UserResult user = userService.agreeToTerms(currentUserId, termsVersion);
        return bibbidiTokenIssuer.issueAccessToken(
                new BibbidiTokenClaims(
                        user.id(),
                        user.status(),
                        user.role(),
                        user.nickname(),
                        user.email()
                )
        );
    }
}
