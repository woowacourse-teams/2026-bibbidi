package com.bibbidi.wedding.auth.controller.dto.response;

import com.bibbidi.wedding.auth.service.dto.IssuedSession;

public record BibbidiSessionResponse(
        String accessToken,
        boolean termsAgreementRequired
) {

    public static BibbidiSessionResponse from(IssuedSession session) {
        return new BibbidiSessionResponse(session.accessToken(), session.termsAgreementRequired());
    }
}
