package com.bibbidi.wedding.auth.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 제공자의 서명 공개키를 담아 두는 방식에 관한 값이다.
 *
 * @param cachedKeyLifetime 받아 둔 공개키를 얼마나 들고 있을지.
 *                          미리 받아 두는 주기보다 길어야 키가 비는 순간이 생기지 않는다
 * @param scheduledRefreshInterval 미리 받아 두는 주기
 * @param unknownKeyRefreshMinInterval 모르는 키 식별자를 만났을 때 제공자를 다시 부르기까지 두는 최소 간격.
 *                                     엉터리 식별자를 계속 보내 외부 호출을 유발하지 못하게 막는다
 * @param maxCachedProviderCount 공개키를 담아 둘 제공자 수 상한
 * @param scheduledRefreshEnabled 미리 받아 둘지 여부. 테스트에서는 꺼서 제공자를 부르지 않는다
 */
@ConfigurationProperties(prefix = "auth.oidc-public-key")
public record OidcPublicKeyCacheProperties(
        Duration cachedKeyLifetime,
        Duration scheduledRefreshInterval,
        Duration unknownKeyRefreshMinInterval,
        long maxCachedProviderCount,
        boolean scheduledRefreshEnabled
) {
}
