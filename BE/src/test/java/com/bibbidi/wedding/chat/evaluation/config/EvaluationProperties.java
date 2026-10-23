package com.bibbidi.wedding.chat.evaluation.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * application-evaluator.yaml의 {@code bibbidi.evaluation} 설정이다.
 * 답변을 만드는 생성 모델과 답변을 채점하는 판정 모델을 따로 고른다.
 */
@ConfigurationProperties("bibbidi.evaluation")
public record EvaluationProperties(ModelProperties generation, ModelProperties judge) {

    public record ModelProperties(String provider, String model, String reasoningEffort, Duration timeout) {

        public String displayName() {
            return provider + "/" + model;
        }
    }
}
