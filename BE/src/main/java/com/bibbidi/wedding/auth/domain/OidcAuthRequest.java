package com.bibbidi.wedding.auth.domain;

import java.time.LocalDateTime;
import org.jspecify.annotations.Nullable;

/**
 * 우리가 시작한 소셜 인증 요청이다. 돌아온 요청이 이것과 맞는지 확인하는 데 쓴다.
 *
 * @param stateHash 인가 주소에 실어 보낸 값의 해시
 * @param browserBinderHash 인가를 시작한 브라우저에만 남긴 값의 해시.
 *                          state는 인가 주소를 타고 나갔다 돌아오므로 새어 나갈 수 있어,
 *                          밖으로 나가지 않는 값을 따로 두어 시작한 브라우저인지 확인한다.
 *                          쿠키를 쓰지 않는 네이티브 요청에는 없다
 */
public record OidcAuthRequest(
        @Nullable Long id,
        String stateHash,
        SocialProvider provider,
        String nonce,
        String codeVerifier,
        @Nullable String browserBinderHash,
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
            @Nullable String browserBinderHash,
            ClientType clientType,
            SocialAuthPurpose purpose,
            LocalDateTime expiresAt
    ) {
        return new OidcAuthRequest(null, stateHash, provider, nonce, codeVerifier, browserBinderHash,
                clientType, purpose, expiresAt, null);
    }

    public boolean isUsable(LocalDateTime now) {
        return usedAt == null && expiresAt.isAfter(now);
    }

    /** 시작한 브라우저가 맞는지 본다. 쿠키를 쓰지 않는 요청은 이 확인을 건너뛴다. */
    public boolean matchesBrowser(@Nullable String browserBinderHash) {
        if (this.browserBinderHash == null) {
            return true;
        }
        return this.browserBinderHash.equals(browserBinderHash);
    }

    public OidcAuthRequest use(LocalDateTime usedAt) {
        return new OidcAuthRequest(id, stateHash, provider, nonce, codeVerifier, browserBinderHash,
                clientType, purpose, expiresAt, usedAt);
    }
}
