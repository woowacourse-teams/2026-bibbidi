package com.bibbidi.wedding.chat.evaluation.local;

import com.bibbidi.wedding.chat.evaluation.claude.ClaudeCliChatModel;
import com.bibbidi.wedding.chat.evaluation.codex.CodexCliChatModel;
import com.bibbidi.wedding.chat.evaluation.data.EvaluationDataLoader;
import com.bibbidi.wedding.chat.evaluation.data.prep.MetricInformation;
import com.bibbidi.wedding.chat.evaluation.judge.BibbidiJudge;
import com.bibbidi.wedding.chat.evaluation.judge.ClaudeCliBibbidiJudge;
import com.bibbidi.wedding.chat.evaluation.judge.CodexCliBibbidiJudge;
import com.bibbidi.wedding.chat.evaluation.report.BibbidiEvaluationReportWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.TestFactory;
import org.junit.jupiter.api.TestInstance;
import org.springframework.ai.chat.model.ChatModel;
import tools.jackson.databind.ObjectMapper;

@Tag("ai-local-evaluation")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class BibbidiLocalEvaluationTest {

    private LocalEvaluationInput input;
    private Map<String, MetricInformation> metrics;
    private LocalEvaluationRunner runner;
    private BibbidiEvaluationReportWriter report;

    @BeforeAll
    void prepare() throws IOException {
        String inputFile = System.getenv("BIBBIDI_LOCAL_EVALUATION_INPUT");
        String generation = System.getenv("BIBBIDI_EVALUATION_GENERATION_MODEL");
        if (inputFile == null || generation == null) {
            throw new IllegalArgumentException(
                    "Set BIBBIDI_LOCAL_EVALUATION_INPUT and BIBBIDI_EVALUATION_GENERATION_MODEL");
        }
        Path inputPath = Path.of(inputFile);
        ObjectMapper mapper = new ObjectMapper();
        input = mapper.readValue(Files.readString(inputPath), LocalEvaluationInput.class);
        metrics = new EvaluationDataLoader().loadMetrics().stream()
                .collect(Collectors.toMap(MetricInformation::metricType, metric -> metric));
        for (var scenario : input.scenarios()) {
            if (scenario.userMessage() == null || scenario.chatMemory() == null
                    || scenario.metrics() == null || scenario.metrics().isEmpty()
                    || !metrics.keySet().containsAll(scenario.metrics())) {
                throw new IllegalArgumentException("Invalid scenario or unknown metrics: " + scenario.name());
            }
        }
        String provider = environment("BIBBIDI_EVALUATION_JUDGE_PROVIDER", "codex");
        String judgeModel = environment("BIBBIDI_EVALUATION_JUDGE_MODEL", "gpt-6-sol");
        String judgeEffort = environment("BIBBIDI_EVALUATION_JUDGE_REASONING_EFFORT", "low");
        Duration judgeTimeout = Duration.parse(environment("BIBBIDI_EVALUATION_JUDGE_TIMEOUT", "PT2M"));
        BibbidiJudge judge = switch (provider) {
            case "codex" -> new CodexCliBibbidiJudge(judgeModel, judgeEffort, judgeTimeout);
            case "claude" -> new ClaudeCliBibbidiJudge(judgeModel, judgeTimeout);
            default -> throw new IllegalArgumentException("Unknown judge provider: " + provider);
        };
        String generationEffort = environment("BIBBIDI_EVALUATION_GENERATION_REASONING_EFFORT", "medium");
        Duration generationTimeout = Duration.parse(environment("BIBBIDI_EVALUATION_GENERATION_TIMEOUT", "PT2M"));
        ChatModel model = generationModel(generation, generationEffort, generationTimeout);
        Path directory = Path.of(environment("BIBBIDI_LOCAL_EVALUATION_REPORT_DIR", "build/reports/ai-local-evaluation"))
                .resolve(Instant.now().toString().replace(':', '-'));
        Files.createDirectories(directory);
        Files.copy(inputPath, directory.resolve("input.json"));
        mapper.writerWithDefaultPrettyPrinter().writeValue(directory.resolve("metrics.json").toFile(), metrics);
        mapper.writerWithDefaultPrettyPrinter().writeValue(directory.resolve("configuration.json").toFile(), Map.of(
                "generationModel", generation, "generationReasoningEffort", generationEffort,
                "generationTimeout", generationTimeout.toString(), "judgeProvider", provider,
                "judgeModel", judgeModel, "judgeReasoningEffort", judgeEffort,
                "judgeTimeout", judgeTimeout.toString()));
        report = new BibbidiEvaluationReportWriter(generation, provider, judgeModel, judgeEffort, directory);
        runner = new LocalEvaluationRunner(model, judge, report);
    }

    @TestFactory
    Stream<DynamicTest> evaluatesPreparedScenarios() {
        return input.scenarios().stream().map(scenario -> DynamicTest.dynamicTest(
                scenario.name(), () -> runner.evaluate(input, scenario, metrics)));
    }

    @AfterAll
    void writeReport() throws IOException {
        if (report != null) {
            report.write();
        }
    }

    private ChatModel generationModel(String selection, String reasoningEffort, Duration timeout) {
        if (selection.startsWith("codex/") && selection.length() > "codex/".length()) {
            return new CodexCliChatModel(selection.substring("codex/".length()),
                    reasoningEffort, timeout);
        }
        if (selection.startsWith("claude/") && selection.length() > "claude/".length()) {
            return new ClaudeCliChatModel(selection.substring("claude/".length()), timeout);
        }
        throw new IllegalArgumentException("Generation model must be codex/<model> or claude/<model>");
    }

    private String environment(String name, String fallback) {
        return System.getenv().getOrDefault(name, fallback);
    }
}
