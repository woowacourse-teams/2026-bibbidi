package com.bibbidi.wedding.chat.evaluation;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.chat.evaluation.data.EvaluationDataLoader;
import com.bibbidi.wedding.chat.evaluation.data.prep.EvaluationScenario;
import com.bibbidi.wedding.chat.evaluation.data.prep.MetricInformation;
import com.bibbidi.wedding.chat.evaluation.judge.BibbidiJudge;
import com.bibbidi.wedding.chat.evaluation.judge.ClaudeCliBibbidiJudge;
import com.bibbidi.wedding.chat.evaluation.judge.CodexCliBibbidiJudge;
import com.bibbidi.wedding.chat.evaluation.report.BibbidiEvaluationReportWriter;
import com.bibbidi.wedding.chat.evaluation.report.ObservedToolCall;
import com.bibbidi.wedding.chat.evaluation.report.RecordingChatModel;
import com.bibbidi.wedding.chat.tools.CatalogTools;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.TestFactory;
import org.junit.jupiter.api.TestInstance;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.document.Document;
import org.springframework.ai.evaluation.EvaluationResponse;
import org.springframework.ai.support.ToolCallbacks;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.ToolDefinition;
import org.springframework.ai.tool.metadata.ToolMetadata;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.Resource;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;

@Tag("ai-evaluation")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@SpringBootTest
@ActiveProfiles("evaluator")
@Import(BibbidiEvaluationIntegrationTest.JudgeConfiguration.class)
@Sql("/load_catalog.sql")
class BibbidiEvaluationIntegrationTest {

    private BibbidiEvaluationReportWriter reportWriter;

    @Autowired
    private ChatModel generationModel;

    @Autowired
    private BibbidiJudge judgeModel;

    @Autowired
    private CatalogService catalogService;

    @Value("classpath:prompts/ai-chat-system.txt")
    private Resource systemPrompt;

    @Value("${spring.ai.bedrock.converse.chat.model}")
    private String generationModelId;

    @Value("${bibbidi.evaluation.judge.provider}")
    private String judgeProvider;

    @Value("${bibbidi.evaluation.judge.model}")
    private String judgeModelId;

    @Value("${bibbidi.evaluation.judge.reasoning-effort}")
    private String judgeReasoningEffort;

    @BeforeAll
    void createReportWriter() {
        reportWriter = new BibbidiEvaluationReportWriter(
                generationModelId, judgeProvider, judgeModelId, judgeReasoningEffort);
    }

    @TestFactory
    Stream<DynamicTest> evaluatesAllScenarios() throws IOException {
        EvaluationDataLoader loader = new EvaluationDataLoader();

        Map<String, MetricInformation> metrics = loader.loadMetrics()
                .stream()
                .collect(
                        Collectors.toMap(
                                MetricInformation::metricType, metric -> metric
                        )
                );
        return loader.loadScenarios()
                .stream()
                .map(scenario -> DynamicTest.dynamicTest(
                                scenario.name(),
                                () -> evaluateScenario(scenario, metrics)
                        )
                );
    }

    @AfterAll
    void writeReport() throws IOException {
        reportWriter.write();
    }

    private void evaluateScenario(EvaluationScenario scenario, Map<String, MetricInformation> metrics) {
        List<Document> observedToolResults = new ArrayList<>();
        List<ObservedToolCall> observedToolCalls = new ArrayList<>();
        RecordingChatModel recordingModel = new RecordingChatModel(generationModel);
        ChatResponse generationResponse = null;
        List<EvaluationResponse> evaluations = new ArrayList<>();
        String phase = "generation";
        String evaluatingMetric = null;
        try {
            ToolCallback catalogTool = recordingCatalogTool(observedToolCalls, observedToolResults);
            ChatClient client = ChatClient.builder(recordingModel)
                    .defaultSystem(systemPrompt, StandardCharsets.UTF_8)
                    .defaultToolCallbacks(catalogTool)
                    .build();
            generationResponse = client.prompt()
                    .messages(scenario.chatMemory().stream().map(this::toMessage).toList())
                    .messages(new UserMessage(scenario.userMessage()))
                    .call()
                    .chatResponse();

            assertThat(generationResponse).isNotNull();
            String responseContent = generationResponse.getResult().getOutput().getText();
            assertThat(responseContent).isNotBlank();
            phase = "toolVerification";
            assertThat(observedToolCalls.stream().map(ObservedToolCall::name).toList())
                    .containsExactlyElementsOf(scenario.expectedToolCalls().stream()
                            .map(EvaluationScenario.ExpectedToolCall::name).toList());

            BibbidiEvaluationRequest request = new BibbidiEvaluationRequest(
                    scenario, observedToolResults, responseContent);
            phase = "metricEvaluation";
            for (String metricType : scenario.metrics()) {
                evaluatingMetric = metricType;
                MetricInformation metric = metrics.get(metricType);
                assertThat(metric).as("unknown metric: %s", metricType).isNotNull();
                var result = new BibbidiEvaluator(metric, judgeModel).evaluate(request);
                assertThat(result.getScore()).isIn(metric.scale().stream()
                        .map(level -> (float) level.value()).toList());
                evaluations.add(result);
                evaluatingMetric = null;
            }
        } catch (RuntimeException | AssertionError failure) {
            reportWriter.recordFailure(scenario, recordingModel.calls(), generationResponse,
                    observedToolCalls, observedToolResults, evaluations, phase, evaluatingMetric, failure);
            throw failure;
        }
        reportWriter.record(scenario, recordingModel.calls(), generationResponse,
                observedToolCalls, observedToolResults, evaluations);
    }

    private Message toMessage(EvaluationScenario.ChatMessage message) {
        return switch (message.role()) {
            case "user" -> new UserMessage(message.content());
            case "assistant" -> new AssistantMessage(message.content());
            default -> throw new IllegalArgumentException("Unknown chat memory role: " + message.role());
        };
    }

    private ToolCallback recordingCatalogTool(List<ObservedToolCall> calls, List<Document> results) {
        ToolCallback delegate = ToolCallbacks.from(new CatalogTools(catalogService))[0];
        return new ToolCallback() {
            @Override
            public ToolDefinition getToolDefinition() {
                return delegate.getToolDefinition();
            }

            @Override
            public ToolMetadata getToolMetadata() {
                return delegate.getToolMetadata();
            }

            @Override
            public String call(String input) {
                calls.add(new ObservedToolCall(getToolDefinition().name(), input));
                return recordResult(delegate.call(input));
            }

            @Override
            public String call(String input, ToolContext context) {
                calls.add(new ObservedToolCall(getToolDefinition().name(), input));
                return recordResult(delegate.call(input, context));
            }

            private String recordResult(String result) {
                results.add(new Document(result));
                return result;
            }
        };
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class JudgeConfiguration {

        @Bean
        BibbidiJudge bibbidiJudge(
                @Value("${bibbidi.evaluation.judge.provider}") String provider,
                @Value("${bibbidi.evaluation.judge.model}") String model,
                @Value("${bibbidi.evaluation.judge.reasoning-effort}") String reasoningEffort,
                @Value("${bibbidi.evaluation.judge.timeout}") String timeout
        ) {
            Duration limit = Duration.parse(timeout);
            return switch (provider) {
                case "codex" -> new CodexCliBibbidiJudge(model, reasoningEffort, limit);
                case "claude" -> new ClaudeCliBibbidiJudge(model, limit);
                default -> throw new IllegalArgumentException("Unknown judge provider: " + provider);
            };
        }
    }
}
