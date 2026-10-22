package com.bibbidi.wedding.chat.evaluation.local;

import com.bibbidi.wedding.chat.evaluation.data.EvaluationDataLoader;
import com.bibbidi.wedding.chat.evaluation.data.prep.EvaluationScenario;
import com.bibbidi.wedding.chat.evaluation.data.prep.MetricInformation;
import com.bibbidi.wedding.chat.evaluation.judge.BibbidiJudge;
import com.bibbidi.wedding.chat.evaluation.report.BibbidiEvaluationReportWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
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

    private final ObjectMapper mapper = new ObjectMapper();

    private LocalEvaluationInput input;
    private Map<String, MetricInformation> metrics;
    private LocalEvaluationRunner runner;
    private BibbidiEvaluationReportWriter report;

    @BeforeAll
    void prepare() throws IOException {
        LocalEvaluationSettings settings = new LocalEvaluationSettings(System.getenv());
        input = readInput(settings.inputPath());
        metrics = loadMetrics();
        input.validateScenarios(metrics.keySet());

        BibbidiJudge judge = settings.createJudge();
        ChatModel answerModel = settings.createAnswerModel();
        report = prepareReport(settings);
        runner = new LocalEvaluationRunner(answerModel, judge, report);
    }

    @TestFactory
    Stream<DynamicTest> evaluatesPreparedScenarios() {
        return input.scenarios().stream().map(this::createScenarioTest);
    }

    @AfterAll
    void writeReport() throws IOException {
        if (report != null) {
            report.write();
        }
    }

    private DynamicTest createScenarioTest(EvaluationScenario scenario) {
        return DynamicTest.dynamicTest(scenario.name(), () -> runner.evaluate(input, scenario, metrics));
    }

    private LocalEvaluationInput readInput(Path path) throws IOException {
        return mapper.readValue(Files.readString(path), LocalEvaluationInput.class);
    }

    private Map<String, MetricInformation> loadMetrics() throws IOException {
        return new EvaluationDataLoader().loadMetrics().stream()
                .collect(Collectors.toMap(MetricInformation::metricType, metric -> metric));
    }

    private BibbidiEvaluationReportWriter prepareReport(LocalEvaluationSettings settings) throws IOException {
        Path directory = settings.createRunDirectoryPath();
        saveRunInputs(directory, settings);
        return settings.createReport(directory);
    }

    private void saveRunInputs(Path directory, LocalEvaluationSettings settings) throws IOException {
        Files.createDirectories(directory);
        Files.copy(settings.inputPath(), directory.resolve("input.json"));
        mapper.writerWithDefaultPrettyPrinter().writeValue(directory.resolve("metrics.json").toFile(), metrics);
        mapper.writerWithDefaultPrettyPrinter().writeValue(
                directory.resolve("configuration.json").toFile(), settings.snapshot());
    }
}
