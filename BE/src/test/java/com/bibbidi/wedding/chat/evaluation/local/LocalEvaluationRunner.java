package com.bibbidi.wedding.chat.evaluation.local;

import com.bibbidi.wedding.chat.evaluation.BibbidiEvaluationRequest;
import com.bibbidi.wedding.chat.evaluation.BibbidiEvaluator;
import com.bibbidi.wedding.chat.evaluation.data.prep.EvaluationScenario;
import com.bibbidi.wedding.chat.evaluation.data.prep.MetricInformation;
import com.bibbidi.wedding.chat.evaluation.judge.BibbidiJudge;
import com.bibbidi.wedding.chat.evaluation.report.BibbidiEvaluationReportWriter;
import com.bibbidi.wedding.chat.evaluation.report.RecordingChatModel;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.document.Document;
import org.springframework.ai.evaluation.EvaluationResponse;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

public class LocalEvaluationRunner {

    private final RecordingChatModel model;
    private final BibbidiJudge judge;
    private final BibbidiEvaluationReportWriter report;
    private final ObjectMapper mapper = new ObjectMapper();

    public LocalEvaluationRunner(ChatModel model, BibbidiJudge judge, BibbidiEvaluationReportWriter report) {
        this.model = new RecordingChatModel(model);
        this.judge = judge;
        this.report = report;
    }

    public void evaluate(LocalEvaluationInput input, EvaluationScenario scenario,
                         Map<String, MetricInformation> metrics) {
        model.reset();
        List<Document> context = input.evaluationContext();
        LocalEvaluationAnswer answer = generateAnswer(input, scenario, context);
        List<EvaluationResponse> evaluations = evaluateMetrics(scenario, context, answer, metrics);

        report.record(scenario, model.calls(), answer.text(), answer.recommendedItemIds(), context, evaluations);
    }

    private LocalEvaluationAnswer generateAnswer(
            LocalEvaluationInput input, EvaluationScenario scenario, List<Document> context) {
        LocalEvaluationAnswer answer = new LocalEvaluationAnswer();
        try {
            Prompt prompt = input.promptFor(scenario);
            answer.readResponse(readModelResponse(prompt));
        } catch (RuntimeException failure) {
            report.recordFailure(scenario, model.calls(), answer.text(), answer.recommendedItemIds(),
                    context, List.of(), "generation", null, failure);
            throw failure;
        }
        return answer;
    }

    private List<EvaluationResponse> evaluateMetrics(
            EvaluationScenario scenario, List<Document> context,
            LocalEvaluationAnswer answer, Map<String, MetricInformation> metrics) {
        BibbidiEvaluationRequest request = new BibbidiEvaluationRequest(scenario, context, answer.text());
        List<EvaluationResponse> evaluations = new ArrayList<>();
        for (String metricType : scenario.metrics()) {
            try {
                evaluations.add(evaluateMetric(request, metrics.get(metricType)));
            } catch (RuntimeException failure) {
                report.recordFailure(scenario, model.calls(), answer.text(), answer.recommendedItemIds(),
                        context, evaluations, "metricEvaluation", metricType, failure);
                throw failure;
            }
        }
        return evaluations;
    }

    private JsonNode readModelResponse(Prompt prompt) {
        ChatResponse response = model.call(prompt);
        String responseJson = response.getResult().getOutput().getText();
        return mapper.readTree(responseJson);
    }

    private EvaluationResponse evaluateMetric(BibbidiEvaluationRequest request, MetricInformation metric) {
        BibbidiEvaluator evaluator = new BibbidiEvaluator(metric, judge);
        return evaluator.evaluate(request);
    }
}
