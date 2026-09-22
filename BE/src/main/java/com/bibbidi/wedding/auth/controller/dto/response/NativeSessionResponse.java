package com.bibbidi.wedding.auth.controller.dto.response;

import com.bibbidi.wedding.auth.service.dto.IssuedSession;

/**
 * 네이티브 앱에 주는 응답이다. 쿠키를 쓰지 않으므로 refresh token도 본문으로 준다.
 *
 * @param accessToken            API를 부를 때 Authorization 헤더에 싣는 값
 * @param refreshToken           access token이 만료되면 새로 받을 때 쓰는 값
 * @param termsAgreementRequired 약관에 동의해야 서비스를 쓸 수 있는 상태인지
 */
public record NativeSessionResponse(
        String accessToken,
        String refreshToken,
        boolean termsAgreementRequired
) {

    public static NativeSessionResponse from(IssuedSession session) {
        return new NativeSessionResponse(
                session.accessToken(), session.refreshToken(), session.termsAgreementRequired());
    }
}
