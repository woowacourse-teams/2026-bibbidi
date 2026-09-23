package com.bibbidi.wedding.auth.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 만료된 인증 기록을 지울 때 쓰는 값이다.
 *
 * @param batchSize 한 번에 지울 행 수
 * @param maxRoundsPerRun 한 번 돌 때 반복할 최대 횟수. 정리가 밀려도 한 번에 다 지우지 않는다
 * @param revokedSessionRetention 폐기한 refresh 세션을 남겨 두는 기간
 * @param cron 정리를 도는 시각
 */
@ConfigurationProperties(prefix = "auth.cleanup")
public record AuthCleanupProperties(
        int batchSize,
        int maxRoundsPerRun,
        Duration revokedSessionRetention,
        String cron
) {
}
