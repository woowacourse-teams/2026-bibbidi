package com.bibbidi.wedding.auth.oidc.client;

import com.bibbidi.wedding.auth.oidc.jwks.OidcPublicKeySet;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.net.URI;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;

@Component
public class OidcPublicKeyFetchClient {

    private final OidcApiClient oidcApiClient;

    public OidcPublicKeyFetchClient(OidcApiClient oidcApiClient) {
        this.oidcApiClient = oidcApiClient;
    }

    public OidcPublicKeySet fetch(String jwksUri) {
        try {
            OidcPublicKeySet keySet = oidcApiClient.fetchOidcPublicKeySet(URI.create(jwksUri));
            verifyKeysNotNull(jwksUri, keySet);
            return keySet;
        } catch (RestClientException exception) {
            throw new BusinessException(
                    ClientError.SOCIAL_AUTHENTICATION_FAILED,
                    "서명 공개키를 받지 못했습니다. jwksUri=" + jwksUri,
                    exception
            );
        }
    }

    private void verifyKeysNotNull(String jwksUri, OidcPublicKeySet keySet) {
        if (keySet == null || keySet.keys() == null || keySet.keys().isEmpty()) {
            throw new BusinessException(
                    ClientError.SOCIAL_AUTHENTICATION_FAILED,
                    "서명 공개키 응답이 비어 있습니다. jwksUri=" + jwksUri
            );
        }
    }
}
