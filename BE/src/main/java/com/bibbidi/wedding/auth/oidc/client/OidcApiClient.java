package com.bibbidi.wedding.auth.oidc.client;

import com.bibbidi.wedding.auth.oidc.jwks.JsonWebKeySet;
import java.net.URI;
import org.springframework.http.MediaType;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.service.annotation.GetExchange;
import org.springframework.web.service.annotation.HttpExchange;
import org.springframework.web.service.annotation.PostExchange;

/**
 * 소셜 제공자를 직접 부르는 자리다.
 * 주소는 제공자 설정에서 오므로 여기에는 제공자 이름이 나오지 않는다.
 */
@HttpExchange
public interface OidcApiClient {

    /** 서명 공개키 묶음을 받아 온다. */
    @GetExchange
    JsonWebKeySet fetchJsonWebKeySet(URI uri);

    /** 인가 코드를 토큰으로 바꾼다. */
    @PostExchange(contentType = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    OidcTokenResponse exchangeToken(URI uri, @RequestBody MultiValueMap<String, String> form);
}
