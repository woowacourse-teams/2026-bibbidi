package com.bibbidi.wedding.chat.evaluation.data.prep;

import java.util.List;

public record MetricInformation(
        String metricType,
        String role,
        String task,
        String rubric,
        List<ScoreLevel> scale,
        String direction,
        List<String> requiredInputs
) {

    public record ScoreLevel(int value, String definition) {
    }
}
