package com.bibbidi.wedding.chat.evaluation;

import com.bibbidi.wedding.chat.evaluation.data.prep.MetricInformation;
import com.bibbidi.wedding.chat.evaluation.judge.BibbidiJudge;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.ai.evaluation.EvaluationRequest;
import org.springframework.ai.evaluation.EvaluationResponse;
import org.springframework.ai.evaluation.Evaluator;
import org.springframework.core.io.ClassPathResource;

public class BibbidiEvaluator implements Evaluator {

    private static final String BIBBIDI_EVALUATOR_ST = "ai-evaluation/prompt/BibbidiEvaluator.st";
    private static final PromptTemplate PROMPT_TEMPLATE;

    static {
        PROMPT_TEMPLATE = new PromptTemplate(new ClassPathResource(BIBBIDI_EVALUATOR_ST));
    }

    private final MetricInformation metric;
    private final BibbidiJudge judge;

    public BibbidiEvaluator(MetricInformation metric, BibbidiJudge judge) {
        this.metric = metric;
        this.judge = judge;
    }

    @Override
    public EvaluationResponse evaluate(EvaluationRequest request) {
        if (!(request instanceof BibbidiEvaluationRequest bibbidiRequest)) {
            throw new IllegalArgumentException("BibbidiEvaluationRequest is required");
        }
        String scale = metric.scale().stream()
                .map(level -> level.value() + ": " + level.definition())
                .collect(Collectors.joining("\n"));
        String inputs = metric.requiredInputs().stream()
                .map(input -> input + ":\n" + bibbidiRequest.inputValue(input))
                .collect(Collectors.joining("\n\n"));
        Prompt prompt = PROMPT_TEMPLATE.create(Map.of(
                "role", metric.role(),
                "task", metric.task(),
                "rubric", metric.rubric(),
                "direction", metric.direction(),
                "scale", scale,
                "scenarioName", bibbidiRequest.scenarioName(),
                "metricType", metric.metricType(),
                "inputs", inputs));

        return judge.evaluate(prompt, metric, bibbidiRequest.scenarioName());
    }
}
