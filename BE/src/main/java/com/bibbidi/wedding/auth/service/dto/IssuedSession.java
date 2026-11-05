package com.bibbidi.wedding.auth.service.dto;

import com.bibbidi.wedding.auth.domain.ClientType;

public record IssuedSession(
        String accessToken,
        String refreshToken,
        ClientType clientType,
        String familyId,
        boolean termsAgreementRequired
) {
}
