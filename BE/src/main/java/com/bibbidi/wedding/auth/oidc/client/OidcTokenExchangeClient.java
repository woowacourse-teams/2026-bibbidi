package com.bibbidi.wedding.auth.oidc.client;

import com.bibbidi.wedding.auth.config.OidcProviderProperties;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.net.URI;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientException;

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
            URI providerTokenIssueEndPoint = URI.create(provider.tokenUri());
            MultiValueMap<String, String> tokenExchangeForm = createTokenExchangeForm(
                    provider,
                    authorizationCode,
                    codeVerifier,
                    redirectUri
            );

            OidcTokenResponse response = oidcApiClient.exchangeToken(providerTokenIssueEndPoint, tokenExchangeForm);
            verifyIdTokenExistence(response);

            return response.idToken();
        } catch (RestClientException exception) {
            throw new BusinessException(
                    ClientError.SOCIAL_AUTHENTICATION_FAILED,
                    "인가 코드를 토큰으로 바꾸지 못했습니다.",
                    exception
            );
        }
    }

    private MultiValueMap<String, String> createTokenExchangeForm(
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

    private void verifyIdTokenExistence(OidcTokenResponse response) {
        if (response == null || response.idToken() == null || response.idToken().isBlank()) {
            throw new BusinessException(
                    ClientError.SOCIAL_AUTHENTICATION_FAILED,
                    "토큰 교환 응답에 id_token이 없습니다."
            );
        }
    }
}
