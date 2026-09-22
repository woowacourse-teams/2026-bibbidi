package com.bibbidi.wedding.auth.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 서명 토큰에 관한 값은 모두 여기 모은다. 코드에 수명이나 식별자를 직접 적지 않는다.
 *
 * @param secret 서명 비밀말. 기본값을 두지 않아 비어 있으면 애플리케이션이 뜨지 않는다.
 * @param issuer 발급자 식별자
 * @param audience 대상 식별자
 * @param accessTokenLifetime access token 수명
 * @param deleteGrantLifetime 탈퇴용 재인증 표의 수명
 * @param headerName access token을 싣는 요청 헤더 이름
 */
@ConfigurationProperties(prefix = "auth.jwt")
public record BibbidiTokenProperties(
        String secret,
        String issuer,
        String audience,
        Duration accessTokenLifetime,
        Duration deleteGrantLifetime,
        String signatureAlgorithm,
        String headerName
) {
}
