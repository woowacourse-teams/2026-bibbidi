package com.bibbidi.wedding.auth.service;

import com.bibbidi.wedding.auth.token.BibbidiTokenClaims;
import com.bibbidi.wedding.auth.token.BibbidiTokenIssuer;
import com.bibbidi.wedding.terms.service.TermsService;
import com.bibbidi.wedding.user.service.UserResult;
import com.bibbidi.wedding.user.service.UserService;
import java.util.List;
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

    public String agree(Long currentUserId, List<Long> agreedTermsIds) {
        termsService.agree(currentUserId, agreedTermsIds);
        UserResult user = userService.activate(currentUserId);
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
