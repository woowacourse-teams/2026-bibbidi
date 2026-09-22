package com.bibbidi.wedding.auth.controller.dto;

import com.bibbidi.wedding.auth.service.session.IssuedSession;

/**
 * 웹에 주는 응답이다. refresh token은 본문에 담지 않고 쿠키로 내려간다.
 *
 * @param accessToken API를 부를 때 Authorization 헤더에 싣는 값
 * @param termsAgreementRequired 약관에 동의해야 서비스를 쓸 수 있는 상태인지
 */
public record WebSessionResponse(String accessToken, boolean termsAgreementRequired) {

    public static WebSessionResponse from(IssuedSession session) {
        return new WebSessionResponse(session.accessToken(), session.termsAgreementRequired());
    }
}
