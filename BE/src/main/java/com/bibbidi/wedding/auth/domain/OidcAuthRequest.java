package com.bibbidi.wedding.auth.domain;

import java.time.LocalDateTime;
import org.jspecify.annotations.Nullable;

/** 우리가 시작한 소셜 인증 요청이다. 돌아온 요청이 이것과 맞는지 확인하는 데 쓴다. */
public record OidcAuthRequest(
        @Nullable Long id,
        String stateHash,
        SocialProvider provider,
        String nonce,
        String codeVerifier,
        ClientType clientType,
        SocialAuthPurpose purpose,
        LocalDateTime expiresAt,
        @Nullable LocalDateTime usedAt
) {

    public static OidcAuthRequest start(
            String stateHash,
            SocialProvider provider,
            String nonce,
            String codeVerifier,
            ClientType clientType,
            SocialAuthPurpose purpose,
            LocalDateTime expiresAt
    ) {
        return new OidcAuthRequest(
                null, stateHash, provider, nonce, codeVerifier, clientType, purpose, expiresAt, null);
    }

    public boolean isUsable(LocalDateTime now) {
        return usedAt == null && expiresAt.isAfter(now);
    }

    public OidcAuthRequest use(LocalDateTime usedAt) {
        return new OidcAuthRequest(
                id, stateHash, provider, nonce, codeVerifier, clientType, purpose, expiresAt, usedAt);
    }
}
