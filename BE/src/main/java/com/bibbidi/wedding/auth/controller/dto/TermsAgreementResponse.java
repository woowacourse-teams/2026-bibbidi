package com.bibbidi.wedding.auth.controller.dto;

/**
 * 약관에 동의하면 상태가 바뀌므로 토큰을 새로 내준다.
 * 이미 발급된 토큰은 만료될 때까지 동의 전 상태를 담고 있기 때문이다.
 *
 * @param accessToken 새 access token
 */
public record TermsAgreementResponse(String accessToken) {
}
