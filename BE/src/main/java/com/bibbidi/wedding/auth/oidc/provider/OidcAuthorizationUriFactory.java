package com.bibbidi.wedding.auth.oidc.provider;

import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.Locale;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

/** 사용자를 보낼 인가 화면 주소를 만든다. 주소의 모양은 제공자 설정에서만 온다. */
@Component
public class OidcAuthorizationUriFactory {

    private static final String CODE_CHALLENGE_METHOD = "S256";

    public String create(
            OidcProviderProperties.Provider provider,
            ClientType clientType,
            String state,
            String nonce,
            String codeChallenge
    ) {
        return UriComponentsBuilder.fromUriString(provider.authorizationUri())
                .queryParam("response_type", "code")
                .queryParam("client_id", provider.clientId())
                .queryParam("redirect_uri", redirectUri(provider, clientType))
                .queryParam("scope", String.join(" ", provider.scopes()))
                .queryParam("state", state)
                .queryParam("nonce", nonce)
                .queryParam("code_challenge", codeChallenge)
                .queryParam("code_challenge_method", CODE_CHALLENGE_METHOD)
                .build()
                .toUriString();
    }

    public String redirectUri(OidcProviderProperties.Provider provider, ClientType clientType) {
        String redirectUri = provider.redirectUris().get(clientType.name().toLowerCase(Locale.ROOT));
        if (redirectUri == null || redirectUri.isBlank()) {
            throw new BusinessException(ClientError.UNSUPPORTED_SOCIAL_PROVIDER,
                    "클라이언트 종류에 맞는 redirect 주소가 설정에 없습니다. clientType=" + clientType);
        }
        return redirectUri;
    }
}
