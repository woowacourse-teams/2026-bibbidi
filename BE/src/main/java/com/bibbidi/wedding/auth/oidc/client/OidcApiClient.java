package com.bibbidi.wedding.auth.oidc.client;

import com.bibbidi.wedding.auth.oidc.jwks.OidcPublicKeySet;
import java.net.URI;
import org.springframework.http.MediaType;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.service.annotation.GetExchange;
import org.springframework.web.service.annotation.HttpExchange;
import org.springframework.web.service.annotation.PostExchange;

@HttpExchange
public interface OidcApiClient {

    @GetExchange
    OidcPublicKeySet fetchOidcPublicKeySet(URI uri);

    @PostExchange(contentType = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    OidcTokenResponse exchangeToken(URI uri, @RequestBody MultiValueMap<String, String> form);
}
