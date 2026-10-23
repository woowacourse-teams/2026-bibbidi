package com.bibbidi.wedding.chat.adapter.ai.loadtest;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * 부하 테스트용 모의 모델이 응답을 흉내 내는 방식이다.
 *
 * @param ttftMs          첫 토큰이 나오기까지의 지연(ms). 기본값은 팀 목표 TTFT(p95 3초)다
 * @param chunkIntervalMs 토큰 사이의 간격(ms)
 * @param chunks          흘려보낼 토큰 수
 * @param throttleRatio   한도 초과로 실패시킬 요청의 비율(0~1)
 */
@ConfigurationProperties(prefix = "bibbidi.ai.loadtest")
public record LoadTestChatModelProperties(
        @DefaultValue("3000") long ttftMs,
        @DefaultValue("50") long chunkIntervalMs,
        @DefaultValue("40") int chunks,
        @DefaultValue("0") double throttleRatio
) {
}
