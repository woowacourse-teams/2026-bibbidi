package com.bibbidi.wedding.chat.evaluation.local;

import com.bibbidi.wedding.chat.evaluation.data.prep.EvaluationScenario;
import java.util.List;

public record LocalEvaluationInput(
        String systemPrompt,
        List<String> providedContext,
        List<EvaluationScenario> scenarios
) {

    public LocalEvaluationInput {
        if (systemPrompt == null || systemPrompt.isBlank()
                || providedContext == null || scenarios == null || scenarios.isEmpty()) {
            throw new IllegalArgumentException("systemPrompt, providedContext and scenarios are required");
        }
        providedContext = List.copyOf(providedContext);
        scenarios = List.copyOf(scenarios);
    }
}
