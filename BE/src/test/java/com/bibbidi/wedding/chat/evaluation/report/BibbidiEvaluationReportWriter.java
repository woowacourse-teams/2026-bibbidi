package com.bibbidi.wedding.chat.evaluation.report;

import com.bibbidi.wedding.chat.evaluation.data.prep.EvaluationScenario;
import com.bibbidi.wedding.chat.evaluation.data.result.JudgeInvocation;
import com.bibbidi.wedding.chat.evaluation.data.result.ModelTokenUsage;
import com.bibbidi.wedding.chat.evaluation.report.RecordingChatModel.ModelCall;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.ToolResponseMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.document.Document;
import org.springframework.ai.evaluation.EvaluationResponse;
import tools.jackson.databind.ObjectMapper;

public class BibbidiEvaluationReportWriter {

    private static final Path REPORT_PATH = Path.of("build/reports/ai-evaluation/result.json");

    private final String generationModel;
    private final JudgeInfo judge;
    private final List<ScenarioResult> scenarios = new ArrayList<>();

    public BibbidiEvaluationReportWriter(String generationModel, String judgeProvider, String judgeModel) {
        this.generationModel = generationModel;
        this.judge = new JudgeInfo(judgeProvider, judgeModel);
    }

    public void record(EvaluationScenario scenario, List<ModelCall> modelCalls, ChatResponse generationResponse,
                       List<String> observedToolCalls, List<Document> observedToolResults,
                       List<EvaluationResponse> evaluations) {
        List<GenerationCall> calls = modelCalls.stream().map(this::generationCall).toList();
        ModelTokenUsage totalUsage = ModelTokenUsage.total(
                calls.stream().map(GenerationCall::tokenUsage).toList());
        GenerationInfo generation = new GenerationInfo(
                generationResponse.getResult().getOutput().getText(), calls, totalUsage);
        List<MetricResult> metricResults = evaluations.stream().map(this::metricResult).toList();
        scenarios.add(new ScenarioResult(scenario.name(), generation,
                List.copyOf(observedToolCalls),
                observedToolResults.stream().map(Document::getText).toList(),
                metricResults));
    }

    public void write() throws IOException {
        Files.createDirectories(REPORT_PATH.getParent());
        EvaluationReport report = new EvaluationReport(generationModel, judge, List.copyOf(scenarios));
        String json = new ObjectMapper().writerWithDefaultPrettyPrinter().writeValueAsString(report);
        Files.writeString(REPORT_PATH, json + System.lineSeparator(), StandardCharsets.UTF_8);
    }

    private MetricResult metricResult(EvaluationResponse response) {
        var metadata = response.getMetadata();
        JudgeInvocation invocation = (JudgeInvocation) metadata.get("judgeInvocation");
        return new MetricResult((String) metadata.get("metricType"),
                ((Number) metadata.get("rawScore")).intValue(), response.getFeedback(),
                new JudgeExchange(invocation.question(), invocation.answer(), invocation.tokenUsage()),
                (boolean) metadata.get("qualityPassDetermined"));
    }

    private GenerationCall generationCall(ModelCall call) {
        List<MessageInfo> question = call.prompt().getInstructions().stream()
                .map(this::messageInfo).toList();
        ChatResponse response = call.response();
        ModelTokenUsage usage = ModelTokenUsage.fromSpring(
                response.getMetadata() == null ? null : response.getMetadata().getUsage());
        return new GenerationCall(question, response.getResult().getOutput().getText(),
                response.getResult().getOutput().getToolCalls().stream().map(tool -> tool.name()).toList(),
                usage);
    }

    private MessageInfo messageInfo(Message message) {
        if (message instanceof ToolResponseMessage toolResponse) {
            String content = toolResponse.getResponses().stream()
                    .map(result -> result.name() + ": " + result.responseData())
                    .reduce((first, second) -> first + "\n" + second).orElse("");
            return new MessageInfo("tool", content);
        }
        return new MessageInfo(message.getMessageType().getValue(), message.getText());
    }

    private record EvaluationReport(String generationModel, JudgeInfo judge, List<ScenarioResult> scenarios) {
    }

    private record JudgeInfo(String provider, String model) {
    }

    private record ScenarioResult(String name, GenerationInfo generation, List<String> observedToolCalls,
                                  List<String> observedToolResults, List<MetricResult> metrics) {
    }

    private record GenerationInfo(String answer, List<GenerationCall> calls, ModelTokenUsage totalTokenUsage) {
    }

    private record GenerationCall(List<MessageInfo> question, String answer, List<String> requestedToolCalls,
                                  ModelTokenUsage tokenUsage) {
    }

    private record MessageInfo(String role, String content) {
    }

    private record MetricResult(String metricType, int score, String reason, JudgeExchange judge,
                                boolean qualityPassDetermined) {
    }

    private record JudgeExchange(String question, String answer, ModelTokenUsage tokenUsage) {
    }
}
