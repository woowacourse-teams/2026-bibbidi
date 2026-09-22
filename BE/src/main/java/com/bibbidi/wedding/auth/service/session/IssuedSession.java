package com.bibbidi.wedding.auth.service.session;

import com.bibbidi.wedding.auth.domain.ClientType;

/**
 * 로그인이나 갱신으로 새로 내준 한 쌍이다.
 * refresh token을 어떤 형태로 내보낼지는 컨트롤러가 clientType을 보고 정한다.
 */
public record IssuedSession(
        String accessToken,
        String refreshToken,
        ClientType clientType,
        String familyId,
        boolean termsAgreementRequired
) {
}
