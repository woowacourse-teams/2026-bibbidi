package com.bibbidi.wedding.auth.oidc.jwks;

/**
 * 제공자가 공개한 서명 키 하나다.
 *
 * @param kid 키 식별자. id_token 헤더가 가리키는 값이다
 * @param kty 키 종류
 * @param alg 서명 알고리즘
 * @param n RSA 모듈러스(base64url)
 * @param e RSA 지수(base64url)
 */
public record JsonWebKey(String kid, String kty, String alg, String n, String e) {
}
