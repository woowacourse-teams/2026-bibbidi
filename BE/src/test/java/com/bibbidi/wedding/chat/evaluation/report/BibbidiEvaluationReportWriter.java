package com.bibbidi.wedding.chat.evaluation.report;

import com.bibbidi.wedding.chat.evaluation.data.prep.EvaluationScenario;
import com.bibbidi.wedding.chat.evaluation.data.result.JudgeInvocation;
import com.bibbidi.wedding.chat.evaluation.data.result.ModelTokenUsage;
import com.bibbidi.wedding.chat.evaluation.judge.BibbidiUnscorableException;
import com.bibbidi.wedding.chat.evaluation.report.RecordingChatModel.ModelCall;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.document.Document;
import org.springframework.ai.evaluation.EvaluationResponse;
import tools.jackson.databind.ObjectMapper;

public class BibbidiEvaluationReportWriter {

    private final Path reportPath;
    private final Path summaryPath;

    private final String generationModel;
    private final JudgeInfo judge;
    private final String executedAt = Instant.now().toString();
    private final List<ScenarioResult> scenarios = new ArrayList<>();

    public BibbidiEvaluationReportWriter(String generationModel, String judgeProvider, String judgeModel,
                                         String reasoningEffort) {
        this(generationModel, judgeProvider, judgeModel, reasoningEffort, Path.of("build/reports/ai-evaluation"));
    }

    public BibbidiEvaluationReportWriter(String generationModel, String judgeProvider, String judgeModel,
                                         String reasoningEffort, Path directory) {
        this.reportPath = directory.resolve("result.json");
        this.summaryPath = directory.resolve("summary.md");
        this.generationModel = generationModel;
        this.judge = new JudgeInfo(judgeProvider, judgeModel,
                "codex".equals(judgeProvider) ? reasoningEffort : null);
    }

    public void record(EvaluationScenario scenario, List<ModelCall> modelCalls, String answer, List<Long> recommendedItemIds,
                       List<Document> providedContext,
                       List<EvaluationResponse> evaluations) {
        scenarios.add(scenarioResult(scenario, modelCalls, answer, recommendedItemIds,
                providedContext, evaluations, "completed", null, null, null));
    }

    public void recordFailure(EvaluationScenario scenario, List<ModelCall> modelCalls, String answer, List<Long> recommendedItemIds,
                              List<Document> providedContext,
                              List<EvaluationResponse> evaluations, String phase, String metricType,
                              Throwable failure) {
        String status = failure instanceof BibbidiUnscorableException ? "unscorable" : "error";
        scenarios.add(scenarioResult(scenario, modelCalls, answer, recommendedItemIds,
                providedContext, evaluations, status, phase, metricType, failure));
    }

    private ScenarioResult scenarioResult(EvaluationScenario scenario, List<ModelCall> modelCalls,
                                          String answer, List<Long> recommendedItemIds,
                                          List<Document> providedContext, List<EvaluationResponse> evaluations,
                                          String status, String phase, String metricType, Throwable failure) {
        List<GenerationCall> calls = modelCalls.stream().map(this::generationCall).toList();
        ModelTokenUsage totalUsage = ModelTokenUsage.total(
                calls.stream().map(GenerationCall::tokenUsage).toList());
        GenerationInfo generation = new GenerationInfo(
                answer, List.copyOf(recommendedItemIds),
                providedContext.stream().map(Document::getText).toList(), calls, totalUsage);
        List<MetricResult> metricResults = new ArrayList<>(evaluations.stream().map(this::metricResult).toList());
        if (metricType != null) {
            metricResults.add(failedMetricResult(metricType, failure));
        }
        FailureInfo failureInfo = failure == null ? null : new FailureInfo(
                phase, metricType, failure.getClass().getSimpleName(), failure.getMessage());
        return new ScenarioResult(scenario.name(), status, failureInfo, generation,
                scenario.metrics(),
                List.copyOf(metricResults));
    }

    public void write() throws IOException {
        Files.createDirectories(reportPath.getParent());
        Summary summary = summary();
        EvaluationReport report = new EvaluationReport(executedAt, generationModel, judge,
                summary, List.copyOf(scenarios));
        String json = new ObjectMapper().writerWithDefaultPrettyPrinter().writeValueAsString(report);
        Files.writeString(reportPath, json + System.lineSeparator(), StandardCharsets.UTF_8);
        Files.writeString(summaryPath, summaryMarkdown(summary), StandardCharsets.UTF_8);
    }

    private Summary summary() {
        int plannedEvaluations = scenarios.stream().mapToInt(result -> result.plannedMetrics().size()).sum();
        List<MetricResult> metrics = scenarios.stream().flatMap(result -> result.metrics().stream()).toList();
        return new Summary(
                scenarios.size(),
                (int) scenarios.stream().filter(result -> "completed".equals(result.status())).count(),
                (int) scenarios.stream().filter(result -> "error".equals(result.status())).count(),
                (int) scenarios.stream().filter(result -> "unscorable".equals(result.status())).count(),
                plannedEvaluations,
                (int) metrics.stream().filter(result -> "scored".equals(result.status())).count(),
                (int) metrics.stream().filter(result -> "error".equals(result.status())).count(),
                (int) metrics.stream().filter(result -> "unscorable".equals(result.status())).count(),
                plannedEvaluations - metrics.size());
    }

    private String summaryMarkdown(Summary summary) {
        return "# AI 평가 실행 요약\n\n"
                + "- 실행 시각: " + executedAt + "\n"
                + "- 생성 모델: " + generationModel + "\n"
                + "- 판독 모델: " + judge.provider() + " / " + judge.model() + "\n\n"
                + "| 구분 | 완료 | 오류 | 평가 불가 | 미실행 |\n"
                + "| --- | ---: | ---: | ---: | ---: |\n"
                + "| 시나리오 | " + summary.completedScenarios() + " | " + summary.errorScenarios()
                + " | " + summary.unscorableScenarios() + " | 0 |\n"
                + "| 지표 (예정 " + summary.plannedEvaluations() + ") | " + summary.scoredEvaluations()
                + " | " + summary.errorEvaluations() + " | " + summary.unscorableEvaluations()
                + " | " + summary.notRunEvaluations() + " |\n";
    }

    private MetricResult metricResult(EvaluationResponse response) {
        var metadata = response.getMetadata();
        JudgeInvocation invocation = (JudgeInvocation) metadata.get("judgeInvocation");
        return new MetricResult((String) metadata.get("metricType"), "scored",
                ((Number) metadata.get("rawScore")).intValue(), response.getFeedback(),
                new JudgeExchange(invocation.question(), invocation.answer(), invocation.tokenUsage()),
                (boolean) metadata.get("qualityPassDetermined"));
    }

    private MetricResult failedMetricResult(String metricType, Throwable failure) {
        if (failure instanceof BibbidiUnscorableException unscorable) {
            JudgeInvocation invocation = unscorable.invocation();
            return new MetricResult(metricType, "unscorable", null, unscorable.getMessage(),
                    invocation == null ? null : new JudgeExchange(
                            invocation.question(), invocation.answer(), invocation.tokenUsage()), false);
        }
        return new MetricResult(metricType, "error", null, failure.getMessage(), null, false);
    }

    private GenerationCall generationCall(ModelCall call) {
        List<MessageInfo> question = call.prompt().getInstructions().stream()
                .map(this::messageInfo).toList();
        ChatResponse response = call.response();
        ModelTokenUsage usage = ModelTokenUsage.fromSpring(
                response.getMetadata() == null ? null : response.getMetadata().getUsage());
        return new GenerationCall(question, response.getResult().getOutput().getText(),
                usage);
    }

    private MessageInfo messageInfo(Message message) {
        return new MessageInfo(message.getMessageType().getValue(), message.getText());
    }

    private record EvaluationReport(String executedAt, String generationModel, JudgeInfo judge,
                                    Summary summary, List<ScenarioResult> scenarios) {
    }

    private record Summary(int totalScenarios, int completedScenarios, int errorScenarios,
                           int unscorableScenarios, int plannedEvaluations, int scoredEvaluations,
                           int errorEvaluations, int unscorableEvaluations, int notRunEvaluations) {
    }

    private record JudgeInfo(String provider, String model, String reasoningEffort) {
    }

    private record ScenarioResult(String name, String status, FailureInfo failure, GenerationInfo generation,
                                  List<String> plannedMetrics,
                                  List<MetricResult> metrics) {
    }

    private record FailureInfo(String phase, String metricType, String type, String message) {
    }

    private record GenerationInfo(String answer, List<Long> recommendedItemIds, List<String> providedContext,
                                  List<GenerationCall> calls, ModelTokenUsage totalTokenUsage) {
    }

    private record GenerationCall(List<MessageInfo> question, String answer,
                                  ModelTokenUsage tokenUsage) {
    }

    private record MessageInfo(String role, String content) {
    }

    private record MetricResult(String metricType, String status, Integer score, String reason, JudgeExchange judge,
                                boolean qualityPassDetermined) {
    }

    private record JudgeExchange(String question, String answer, ModelTokenUsage tokenUsage) {
    }
}
