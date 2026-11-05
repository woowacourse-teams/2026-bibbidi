package com.bibbidi.wedding.chat.evaluation;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.chat.adapter.ai.BibbidiInMemoryChatMemory;
import com.bibbidi.wedding.chat.evaluation.data.EvaluationDataLoader;
import com.bibbidi.wedding.chat.evaluation.data.prep.EvaluationScenario;
import com.bibbidi.wedding.chat.evaluation.data.prep.MetricInformation;
import com.bibbidi.wedding.chat.evaluation.judge.BibbidiJudge;
import com.bibbidi.wedding.chat.evaluation.judge.ClaudeCliBibbidiJudge;
import com.bibbidi.wedding.chat.evaluation.judge.CodexCliBibbidiJudge;
import com.bibbidi.wedding.chat.evaluation.report.BibbidiEvaluationReportWriter;
import com.bibbidi.wedding.chat.evaluation.report.RecordingChatModel;
import com.bibbidi.wedding.chat.service.AiChatService;
import java.io.IOException;
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
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.evaluation.EvaluationResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import tools.jackson.databind.ObjectMapper;

@Tag("ai-evaluation")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@SpringBootTest
@ActiveProfiles({"test", "evaluator"})
@Import({BibbidiEvaluationIntegrationTest.JudgeConfiguration.class,
        BibbidiEvaluationIntegrationTest.ModelRecordingConfiguration.class})
@Sql({"/load_catalog.sql", "/ai-evaluation/evaluation-user.sql"})
class BibbidiEvaluationIntegrationTest {

    private BibbidiEvaluationReportWriter reportWriter;

    @Autowired
    private ChatModel generationModel;

    @Autowired
    private BibbidiJudge judgeModel;

    @Autowired
    private AiChatService chatService;

    @Autowired
    private BibbidiInMemoryChatMemory chatMemory;

    @Autowired
    private ObjectMapper mapper;

    @Value("${bibbidi.sse.response-timeout-seconds}")
    private long responseTimeoutSeconds;

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
        RecordingChatModel recordingModel = (RecordingChatModel) generationModel;
        EvaluationChatRunner runner = new EvaluationChatRunner(chatService, chatMemory, recordingModel, mapper);
        List<EvaluationResponse> evaluations = new ArrayList<>();
        String phase = "generation";
        String evaluatingMetric = null;
        try {
            runner.run(scenario, 900001L, Duration.ofSeconds(responseTimeoutSeconds + 15));
            BibbidiEvaluationRequest request = new BibbidiEvaluationRequest(
                    scenario, runner.providedContext(), runner.answer());
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
            reportWriter.recordFailure(scenario, recordingModel.calls(), runner.answer(), runner.recommendedItemIds(),
                    runner.providedContext(), evaluations, phase, evaluatingMetric, failure);
            throw failure;
        }
        reportWriter.record(scenario, recordingModel.calls(), runner.answer(), runner.recommendedItemIds(),
                runner.providedContext(), evaluations);
    }

    // 실제 ChatClient 설정을 유지하며 평가 프로필에서만 생성 모델 입출력을 기록한다.
    @TestConfiguration(proxyBeanMethods = false)
    static class ModelRecordingConfiguration {

        @Bean
        static BeanPostProcessor recordGenerationModels() {
            return new BeanPostProcessor() {
                @Override
                public Object postProcessAfterInitialization(Object bean, String beanName) {
                    return bean instanceof ChatModel model && !(bean instanceof RecordingChatModel)
                            ? new RecordingChatModel(model) : bean;
                }
            };
        }
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
