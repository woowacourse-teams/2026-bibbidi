package com.bibbidi.wedding.auth.token;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 로그인 상태를 얼마나 유지할지에 관한 값이다.
 *
 * @param refreshTokenTtl refresh token 수명. 갱신할 때마다 이만큼 다시 밀린다
 * @param handoffCodeTtl 네이티브에서 WebView로 넘길 때 쓰는 코드의 수명
 * @param authRequestTtl 인가 요청을 기다려 주는 시간
 */
@ConfigurationProperties(prefix = "auth.session")
public record SessionProperties(
        Duration refreshTokenTtl,
        Duration handoffCodeTtl,
        Duration authRequestTtl
) {
}
