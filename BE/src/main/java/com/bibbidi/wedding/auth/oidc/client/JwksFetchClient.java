package com.bibbidi.wedding.auth.oidc.client;

import com.bibbidi.wedding.auth.oidc.jwks.JsonWebKeySet;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.net.URI;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;

/**
 * 제공자의 서명 공개키를 받아 온다.
 * 실패를 조용히 삼키지 않고 오류로 드러낸다. 못 받으면 로그인 자체가 성립하지 않기 때문이다.
 */
@Component
public class JwksFetchClient {

    private final OidcApiClient oidcApiClient;

    public JwksFetchClient(OidcApiClient oidcApiClient) {
        this.oidcApiClient = oidcApiClient;
    }

    public JsonWebKeySet fetch(String jwksUri) {
        try {
            JsonWebKeySet keySet = oidcApiClient.fetchJsonWebKeySet(URI.create(jwksUri));
            if (keySet == null || keySet.keys() == null || keySet.keys().isEmpty()) {
                throw new BusinessException(ClientError.SOCIAL_AUTHENTICATION_FAILED,
                        "서명 공개키 응답이 비어 있습니다. jwksUri=" + jwksUri);
            }
            return keySet;
        } catch (RestClientException exception) {
            throw new BusinessException(ClientError.SOCIAL_AUTHENTICATION_FAILED,
                    "서명 공개키를 받지 못했습니다. jwksUri=" + jwksUri, exception);
        }
    }
}
