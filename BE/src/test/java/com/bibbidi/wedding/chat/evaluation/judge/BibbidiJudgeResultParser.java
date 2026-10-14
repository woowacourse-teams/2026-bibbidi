package com.bibbidi.wedding.chat.evaluation.judge;

import com.bibbidi.wedding.chat.evaluation.data.prep.MetricInformation;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.ai.evaluation.EvaluationResponse;
import tools.jackson.databind.ObjectMapper;

final class BibbidiJudgeResultParser {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    static EvaluationResponse parse(String json, MetricInformation metric, String scenarioName,
                                    Map<String, Object> judgeMetadata) {
        JudgeResult result = OBJECT_MAPPER.readValue(json, JudgeResult.class);
        if (!scenarioName.equals(result.scenarioName()) || !metric.metricType().equals(result.metricType())) {
            throw new IllegalStateException("Judge returned a different scenario or metric");
        }
        if (result.reason() == null || result.reason().isBlank()) {
            throw new IllegalStateException("Judge returned an empty reason");
        }
        if ("unscorable".equals(result.status()) && result.score() == null) {
            throw new UnscorableException(result.reason());
        }
        if (!"scored".equals(result.status())) {
            throw new IllegalStateException("Judge returned an invalid status or score combination");
        }
        if (result.score() == null || metric.scale().stream()
                .noneMatch(level -> level.value() == result.score())) {
            throw new IllegalStateException("Judge returned a score outside the metric scale");
        }
        Map<String, Object> metadata = new LinkedHashMap<>(judgeMetadata);
        metadata.put("scenarioName", scenarioName);
        metadata.put("metricType", metric.metricType());
        metadata.put("rawScore", result.score());
        metadata.put("scale", metric.scale());
        metadata.put("direction", metric.direction());
        metadata.put("qualityPassDetermined", false);
        return new EvaluationResponse(false, result.score(), result.reason(), Map.copyOf(metadata));
    }

    static final class UnscorableException extends RuntimeException {

        UnscorableException(String reason) {
            super(reason);
        }
    }

    private record JudgeResult(String scenarioName, String metricType, String status, Integer score, String reason) {
    }
}
