package com.bibbidi.wedding.auth.oidc.client;

import com.fasterxml.jackson.annotation.JsonProperty;

/** @param idToken 제공자가 서명한 사용자 신원 정보 */
public record OidcTokenResponse(@JsonProperty("id_token") String idToken) {
}
