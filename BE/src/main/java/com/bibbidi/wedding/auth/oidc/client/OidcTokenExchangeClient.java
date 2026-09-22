package com.bibbidi.wedding.auth.oidc.client;

import com.bibbidi.wedding.auth.oidc.provider.OidcProviderProperties;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.net.URI;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientException;

/**
 * 인가 코드를 토큰으로 바꾼다. 교환은 서버에서만 하고 클라이언트에는 코드만 오간다.
 * 인가 코드와 받은 토큰은 로그에 남기지 않는다.
 */
@Component
public class OidcTokenExchangeClient {

    private static final String GRANT_TYPE = "authorization_code";

    private final OidcApiClient oidcApiClient;

    public OidcTokenExchangeClient(OidcApiClient oidcApiClient) {
        this.oidcApiClient = oidcApiClient;
    }

    public String exchangeForIdToken(
            OidcProviderProperties.Provider provider,
            String authorizationCode,
            String codeVerifier,
            String redirectUri
    ) {
        try {
            OidcTokenResponse response = oidcApiClient.exchangeToken(
                    URI.create(provider.tokenUri()),
                    form(provider, authorizationCode, codeVerifier, redirectUri));
            if (response == null || response.idToken() == null || response.idToken().isBlank()) {
                throw new BusinessException(ClientError.SOCIAL_AUTHENTICATION_FAILED,
                        "토큰 교환 응답에 id_token이 없습니다.");
            }
            return response.idToken();
        } catch (RestClientException exception) {
            throw new BusinessException(ClientError.SOCIAL_AUTHENTICATION_FAILED,
                    "인가 코드를 토큰으로 바꾸지 못했습니다.", exception);
        }
    }

    private static MultiValueMap<String, String> form(
            OidcProviderProperties.Provider provider,
            String authorizationCode,
            String codeVerifier,
            String redirectUri
    ) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", GRANT_TYPE);
        form.add("client_id", provider.clientId());
        form.add("client_secret", provider.clientSecret());
        form.add("code", authorizationCode);
        form.add("code_verifier", codeVerifier);
        form.add("redirect_uri", redirectUri);
        return form;
    }
}
