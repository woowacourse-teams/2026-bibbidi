package com.bibbidi.wedding.auth.oidc.client;

import com.fasterxml.jackson.annotation.JsonProperty;

public record OidcTokenResponse(@JsonProperty("id_token") String idToken) {
}
