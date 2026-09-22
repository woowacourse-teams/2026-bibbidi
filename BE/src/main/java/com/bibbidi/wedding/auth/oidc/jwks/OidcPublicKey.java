package com.bibbidi.wedding.auth.oidc.jwks;

/**
 * @param kid 키 식별자.
 * @param kty 키 종류
 * @param alg 서명 알고리즘
 * @param n   RSA 모듈러스(base64url)
 * @param e   RSA 지수(base64url)
 */
public record OidcPublicKey(
        String kid,
        String kty,
        String alg,
        String n,
        String e
) {
}
