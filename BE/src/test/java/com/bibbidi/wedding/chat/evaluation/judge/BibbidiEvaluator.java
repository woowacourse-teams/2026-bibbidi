package com.bibbidi.wedding.chat.evaluation.judge;

import com.bibbidi.wedding.chat.evaluation.input.MetricInformation;
import com.bibbidi.wedding.chat.evaluation.report.JudgeInvocation;
import com.bibbidi.wedding.chat.evaluation.report.ModelTokenUsage;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.ai.evaluation.EvaluationRequest;
import org.springframework.ai.evaluation.EvaluationResponse;
import org.springframework.ai.evaluation.Evaluator;
import org.springframework.core.io.ClassPathResource;

public class BibbidiEvaluator implements Evaluator {

    public static final String JUDGE_RESULT_SCHEMA = "ai-evaluation/schema/judge-result.json";

    private static final String BIBBIDI_EVALUATOR_ST = "ai-evaluation/prompt/BibbidiEvaluator.st";
    private static final PromptTemplate PROMPT_TEMPLATE;

    static {
        PROMPT_TEMPLATE = new PromptTemplate(new ClassPathResource(BIBBIDI_EVALUATOR_ST));
    }

    private final MetricInformation metric;
    private final ChatModel judgeModel;

    public BibbidiEvaluator(MetricInformation metric, ChatModel judgeModel) {
        this.metric = metric;
        this.judgeModel = judgeModel;
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

        ChatResponse response = judgeModel.call(prompt);
        String answer = response.getResult().getOutput().getText();
        JudgeInvocation invocation = new JudgeInvocation(
                prompt.getContents(),
                answer,
                ModelTokenUsage.fromSpring(response.getMetadata().getUsage())
        );

        return BibbidiJudgeResultParser.parse(
                answer,
                metric,
                bibbidiRequest.scenarioName(),
                Map.of(
                        "judgeModel", response.getMetadata().getModel(),
                        "judgeInvocation", invocation
                )
        );
    }
}
