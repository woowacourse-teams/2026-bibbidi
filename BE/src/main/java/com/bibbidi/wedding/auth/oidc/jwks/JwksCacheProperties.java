package com.bibbidi.wedding.auth.oidc.jwks;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 서명 공개키 캐시에 관한 값이다.
 *
 * @param ttl 캐시에 담아 두는 기간. 미리 받아 두는 주기보다 길어야 틈이 생기지 않는다
 * @param refreshInterval 미리 받아 두는 주기
 * @param forcedRefreshMinInterval 모르는 키를 만났을 때 강제로 다시 받는 최소 간격
 * @param maximumSize 캐시에 담을 제공자 수 상한
 * @param warmUpEnabled 미리 받아 둘지 여부. 테스트에서는 꺼서 외부 호출을 하지 않는다
 */
@ConfigurationProperties(prefix = "auth.oidc-jwks")
public record JwksCacheProperties(
        Duration ttl,
        Duration refreshInterval,
        Duration forcedRefreshMinInterval,
        long maximumSize,
        boolean warmUpEnabled
) {
}
