package com.bibbidi.wedding.chat.evaluation.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * application-evaluator.yaml의 {@code bibbidi.evaluation} 설정이다.
 * 답변을 만드는 생성 모델(luna, sol)과 답변을 채점하는 판정 모델을 따로 고른다.
 */
@ConfigurationProperties("bibbidi.evaluation")
public record EvaluationProperties(GenerationProperties generation, ModelProperties judge) {

    /**
     * luna와 sol은 같은 공급자의 CLI 모델이라 공급자, 추론 강도, 제한 시간은 공유하고 모델명만 따로 받는다.
     */
    public record GenerationProperties(
            String provider, String lunaModel, String solModel, String reasoningEffort, Duration timeout) {

        public String displayName() {
            return provider + "/" + lunaModel + "+" + solModel;
        }
    }

    public record ModelProperties(String provider, String model, String reasoningEffort, Duration timeout) {

        public String displayName() {
            return provider + "/" + model;
        }
    }
}
