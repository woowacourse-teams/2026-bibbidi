package com.bibbidi.wedding.chat.evaluation;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.chat.evaluation.config.EvaluationModelConfiguration;
import com.bibbidi.wedding.chat.evaluation.config.EvaluationModelConfiguration.JudgeModel;
import com.bibbidi.wedding.chat.evaluation.config.EvaluationProperties;
import com.bibbidi.wedding.chat.evaluation.config.ModelRecordingConfiguration;
import com.bibbidi.wedding.chat.evaluation.input.EvaluationDataLoader;
import com.bibbidi.wedding.chat.evaluation.input.EvaluationScenario;
import com.bibbidi.wedding.chat.evaluation.input.MetricInformation;
import com.bibbidi.wedding.chat.evaluation.judge.BibbidiEvaluationRequest;
import com.bibbidi.wedding.chat.evaluation.judge.BibbidiEvaluator;
import com.bibbidi.wedding.chat.evaluation.report.BibbidiEvaluationReportWriter;
import com.bibbidi.wedding.chat.evaluation.report.RecordingChatModel;
import com.bibbidi.wedding.chat.adapter.ai.routing.ModelClassifier;
import com.bibbidi.wedding.chat.service.AiChatService;
import com.bibbidi.wedding.chat.service.ConversationKey;
import com.bibbidi.wedding.chat.service.dto.command.ChatCommand;
import com.bibbidi.wedding.chat.service.dto.result.ChatResult;
import com.bibbidi.wedding.chat.service.turn.CancelReason;
import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.TestFactory;
import org.junit.jupiter.api.TestInstance;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.ToolResponseMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.document.Document;
import org.springframework.ai.evaluation.EvaluationResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;

@Tag("ai-evaluation")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@SpringBootTest
@ActiveProfiles({"test", "evaluator"})
@Import({EvaluationModelConfiguration.class, ModelRecordingConfiguration.class})
@Sql({"/load_catalog.sql", "/ai-evaluation/evaluation-user.sql"})
class BibbidiEvaluationIntegrationTest {

    private static final String SCENARIO_FILTER_ENV = "BIBBIDI_EVALUATION_SCENARIO";
    private static final long EVALUATION_USER_ID = 900001L;
    private static final long CHAT_TIMEOUT_MARGIN_SECONDS = 15;

    private static final String PHASE_GENERATION = "generation";
    private static final String PHASE_METRIC_EVALUATION = "metricEvaluation";

    @Autowired
    private AiChatService chatService;

    @Autowired
    private ChatMemory chatMemory;

    @Autowired
    private ChatModel generationModel;

    @Autowired
    private JudgeModel judgeModel;

    @Autowired
    private EvaluationProperties properties;

    @Autowired
    private ModelClassifier classifier;

    @Value("${bibbidi.ai.chatbot.routing.api-key:}")
    private String jevApiKey;

    @Value("${bibbidi.sse.response-timeout-seconds}")
    private long responseTimeoutSeconds;

    private RecordingChatModel recordingModel;
    private BibbidiEvaluationReportWriter reportWriter;

    @BeforeAll
    void prepare() {
        recordingModel = (RecordingChatModel) generationModel;
        reportWriter = new BibbidiEvaluationReportWriter(
                properties.generation().displayName(), properties.judge().provider(),
                properties.judge().model(), properties.judge().reasoningEffort());
    }

    @AfterAll
    void writeReport() throws IOException {
        reportWriter.write();
    }

    @TestFactory
    Stream<DynamicTest> evaluatesAllScenarios() throws IOException {
        EvaluationDataLoader loader = new EvaluationDataLoader();
        Map<String, MetricInformation> metrics = loader.loadMetrics().stream()
                .collect(Collectors.toMap(MetricInformation::metricType, metric -> metric));
        String onlyScenario = System.getenv().getOrDefault(SCENARIO_FILTER_ENV, "");

        return loader.loadScenarios().stream()
                .filter(scenario -> onlyScenario.isBlank() || scenario.name().equals(onlyScenario))
                .map(scenario -> DynamicTest.dynamicTest(
                        scenario.name(), () -> evaluateScenario(scenario, metrics)));
    }

    private void evaluateScenario(EvaluationScenario scenario, Map<String, MetricInformation> metrics) {
        GeneratedAnswer generated = new GeneratedAnswer();
        GenerationMeasurement measurement = new GenerationMeasurement();
        List<EvaluationResponse> evaluations = new ArrayList<>();
        String phase = PHASE_GENERATION;
        String evaluatingMetric = null;
        try {
            generate(scenario, generated, measurement);

            phase = PHASE_METRIC_EVALUATION;
            BibbidiEvaluationRequest request = new BibbidiEvaluationRequest(
                    scenario, providedContext(), generated.answer());
            for (String metricType : scenario.metrics()) {
                evaluatingMetric = metricType;
                evaluations.add(evaluateMetric(request, metrics, metricType));
                evaluatingMetric = null;
            }
        } catch (RuntimeException | AssertionError failure) {
            reportWriter.recordFailure(scenario, recordingModel.calls(), generated.answer(),
                    generated.recommendedItemIds(), providedContext(), evaluations,
                    phase, evaluatingMetric, failure,
                    measurement.selectedTier, measurement.firstDeltaMs, measurement.totalMs);
            throw failure;
        }
        reportWriter.record(scenario, recordingModel.calls(), generated.answer(),
                generated.recommendedItemIds(), providedContext(), evaluations,
                measurement.selectedTier, measurement.firstDeltaMs, measurement.totalMs);
    }

    private void generate(EvaluationScenario scenario, GeneratedAnswer generated, GenerationMeasurement measurement) {
        UUID conversationId = UUID.randomUUID();
        String memoryKey = new ConversationKey(EVALUATION_USER_ID, conversationId).toMemoryKey();
        Duration timeout = Duration.ofSeconds(responseTimeoutSeconds + CHAT_TIMEOUT_MARGIN_SECONDS);
        recordingModel.reset();
        try {
            chatMemory.add(memoryKey, scenario.chatMemory().stream().map(this::toMessage).toList());
            if (!jevApiKey.isBlank()) {
                measurement.selectedTier = classifier.classify(memoryKey, scenario.userMessage())
                        .block(timeout).name();
            }
            long startedAt = System.nanoTime();
            chatService.chat(
                            new ChatCommand(EVALUATION_USER_ID, conversationId, scenario.userMessage()),
                            () -> CancelReason.CLIENT_DISCONNECTED)
                    .doOnNext(event -> {
                        if (event instanceof ChatResult.Delta delta && !delta.text().isEmpty()
                                && measurement.firstDeltaMs == null) {
                            measurement.firstDeltaMs = Duration.ofNanos(System.nanoTime() - startedAt).toMillis();
                        }
                    })
                    .doOnNext(generated::accept)
                    .blockLast(timeout);
            measurement.totalMs = Duration.ofNanos(System.nanoTime() - startedAt).toMillis();
            if (!generated.isComplete()) {
                throw new IllegalStateException("평가 답변이 정상 완료되지 않았습니다.");
            }
        } finally {
            chatMemory.clear(memoryKey);
        }
    }

    private static final class GenerationMeasurement {
        private String selectedTier;
        private Long firstDeltaMs;
        private Long totalMs;
    }

    private EvaluationResponse evaluateMetric(
            BibbidiEvaluationRequest request, Map<String, MetricInformation> metrics, String metricType) {
        MetricInformation metric = metrics.get(metricType);
        assertThat(metric).as("unknown metric: %s", metricType).isNotNull();

        EvaluationResponse result = new BibbidiEvaluator(metric, judgeModel.chatModel()).evaluate(request);

        List<Float> allowedScores = metric.scale().stream().map(level -> (float) level.value()).toList();
        assertThat(result.getScore()).isIn(allowedScores);
        return result;
    }

    private List<Document> providedContext() {
        return recordingModel.calls().stream()
                .flatMap(call -> call.prompt().getInstructions().stream())
                .filter(ToolResponseMessage.class::isInstance)
                .map(ToolResponseMessage.class::cast)
                .flatMap(message -> message.getResponses().stream())
                .map(ToolResponseMessage.ToolResponse::responseData)
                .distinct()
                .map(Document::new)
                .toList();
    }

    private Message toMessage(EvaluationScenario.ChatMessage message) {
        return switch (message.role()) {
            case "user" -> new UserMessage(message.content());
            case "assistant" -> new AssistantMessage(message.content());
            default -> throw new IllegalArgumentException("Unknown chat memory role: " + message.role());
        };
    }
}
