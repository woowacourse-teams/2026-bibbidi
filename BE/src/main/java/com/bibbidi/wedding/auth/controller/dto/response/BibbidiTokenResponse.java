package com.bibbidi.wedding.auth.controller.dto.response;

import com.bibbidi.wedding.auth.service.dto.IssuedSession;

public record BibbidiTokenResponse(
        String accessToken,
        String refreshToken,
        boolean termsAgreementRequired
) {

    public static BibbidiTokenResponse from(IssuedSession session) {
        return new BibbidiTokenResponse(
                session.accessToken(),
                session.refreshToken(),
                session.termsAgreementRequired());
    }
}
