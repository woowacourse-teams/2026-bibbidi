package com.bibbidi.wedding.auth.service.terms;

import com.bibbidi.wedding.auth.token.BibbidiTokenClaims;
import com.bibbidi.wedding.auth.token.BibbidiTokenIssuer;
import com.bibbidi.wedding.terms.service.TermsService;
import com.bibbidi.wedding.user.service.UserResult;
import com.bibbidi.wedding.user.service.UserService;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 약관 동의로 가입을 끝낸다.
 *
 * <p>동의 기록은 약관 쪽에 남기고, 이 자리에서는 회원을 쓸 수 있는 상태로 바꾼 뒤 토큰을 새로 내준다.
 * 가입 상태가 토큰에 담겨 있어, 새로 내주지 않으면 이미 발급된 토큰이 만료될 때까지 계속 막히기 때문이다.
 */
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
                new BibbidiTokenClaims(user.id(), user.status(), user.role(), user.nickname(), user.email()));
    }
}
