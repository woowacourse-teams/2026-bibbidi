package com.bibbidi.wedding.chat.evaluation.local;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.chat.evaluation.data.prep.EvaluationScenario;
import com.bibbidi.wedding.chat.evaluation.data.prep.MetricInformation;
import com.bibbidi.wedding.chat.evaluation.data.result.JudgeInvocation;
import com.bibbidi.wedding.chat.evaluation.data.result.ModelTokenUsage;
import com.bibbidi.wedding.chat.evaluation.judge.BibbidiJudge;
import com.bibbidi.wedding.chat.evaluation.report.BibbidiEvaluationReportWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.DefaultUsage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.evaluation.EvaluationResponse;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class LocalEvaluationRunnerTest {

    @TempDir
    Path directory;

    private final EvaluationScenario scenario = new EvaluationScenario("prepared", List.of("Completeness"),
            "다음 준비는?", List.of(new EvaluationScenario.ChatMessage("user", "웨딩홀은 정했어")),
            "드레스 준비", "");
    private final LocalEvaluationInput input = new LocalEvaluationInput("입력한 규칙", List.of("입력한 카탈로그"),
            List.of(scenario));
    private final MetricInformation metric = new MetricInformation("Completeness", "role", "task", "rubric",
            List.of(new MetricInformation.ScoreLevel(4, "complete")), "higher",
            List.of("chatMemory", "userMessage", "modelResponse", "providedContext"));

    @Test
    @DisplayName("입력한 자료와 대화로 직접 답변하고 같은 자료로 채점해 결과를 저장한다")
    void evaluatesPreparedInputAndPreservesTheExchange() throws IOException {
        List<Prompt> generationPrompts = new ArrayList<>();
        List<Prompt> judgePrompts = new ArrayList<>();
        ChatModel model = prompt -> {
            generationPrompts.add(prompt);
            return response("{\"answer\":\"드레스를 준비해요\",\"recommendedItemIds\":[12]}");
        };
        BibbidiJudge judge = (prompt, information, name) -> {
            judgePrompts.add(prompt);
            return score(prompt);
        };
        BibbidiEvaluationReportWriter report = report();
        LocalEvaluationRunner runner = new LocalEvaluationRunner(model, judge, report);

        runner.evaluate(input, scenario, Map.of(metric.metricType(), metric));
        report.write();

        assertThat(generationPrompts).singleElement().satisfies(prompt -> {
            assertThat(prompt.getInstructions()).extracting(message -> message.getText())
                    .containsExactly("입력한 규칙", "입력한 카탈로그", "웨딩홀은 정했어", "다음 준비는?");
        });
        assertThat(judgePrompts).singleElement().satisfies(prompt ->
                assertThat(prompt.getContents()).contains("입력한 규칙", "입력한 카탈로그", "웨딩홀은 정했어", "드레스를 준비해요"));
        JsonNode result = result().path("scenarios").get(0);
        assertThat(result.path("status").asText()).isEqualTo("completed");
        assertThat(result.path("generation").path("answer").asText()).isEqualTo("드레스를 준비해요");
        assertThat(result.path("generation").path("recommendedItemIds").get(0).asLong()).isEqualTo(12);
        assertThat(result.path("generation").path("totalTokenUsage").path("totalTokens").asInt()).isEqualTo(15);
        assertThat(result.path("metrics").get(0).path("score").asInt()).isEqualTo(4);
        assertThat(result.path("metrics").get(0).path("reason").asText()).isEqualTo("채점 이유");
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"answer\":\"text\"}", "{\"answer\":\"text\",\"recommendedItemIds\":[1.5]}",
            "{\"answer\":\"\",\"recommendedItemIds\":[]}"})
    @DisplayName("형식이 맞지 않는 답변은 채점하지 않고 생성 실패로 저장한다")
    void recordsMalformedAnswersWithoutJudging(String answer) throws IOException {
        BibbidiEvaluationReportWriter report = report();
        LocalEvaluationRunner runner = new LocalEvaluationRunner(prompt -> response(answer),
                (prompt, information, name) -> { throw new AssertionError("Must not judge malformed responses"); }, report);

        assertThatThrownBy(() -> runner.evaluate(input, scenario, Map.of(metric.metricType(), metric)))
                .isInstanceOf(IllegalStateException.class);
        report.write();

        JsonNode failure = result().path("scenarios").get(0).path("failure");
        assertThat(failure.path("phase").asText()).isEqualTo("generation");
        assertThat(failure.path("timedOut").asBoolean()).isFalse();
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    @DisplayName("생성 단계와 채점 단계의 시간 초과를 일반 실패와 구분해 저장한다")
    void distinguishesTimeoutsAtEachPhase(boolean judgeTimeout) throws IOException {
        BibbidiEvaluationReportWriter report = report();
        ChatModel model = prompt -> {
            if (!judgeTimeout) {
                throw new IllegalStateException("generation timeout", new TimeoutException());
            }
            return response("{\"answer\":\"text\",\"recommendedItemIds\":[]}");
        };
        LocalEvaluationRunner runner = new LocalEvaluationRunner(model,
                (prompt, information, name) -> { throw new IllegalStateException("judge timeout", new TimeoutException()); }, report);

        assertThatThrownBy(() -> runner.evaluate(input, scenario, Map.of(metric.metricType(), metric)))
                .hasCauseInstanceOf(TimeoutException.class);
        report.write();

        JsonNode failure = result().path("scenarios").get(0).path("failure");
        assertThat(failure.path("phase").asText()).isEqualTo(judgeTimeout ? "metricEvaluation" : "generation");
        assertThat(failure.path("timedOut").asBoolean()).isTrue();
        assertThat(result().path("summary").path("errorScenarios").asInt()).isEqualTo(1);
    }

    @Test
    @DisplayName("다음 시나리오에 이전 실행의 답변과 대화를 섞지 않는다")
    void keepsScenariosIndependent() throws IOException {
        List<Prompt> prompts = new ArrayList<>();
        BibbidiEvaluationReportWriter report = report();
        LocalEvaluationRunner runner = new LocalEvaluationRunner(prompt -> {
            prompts.add(prompt);
            return response("{\"answer\":\"text\",\"recommendedItemIds\":[]}");
        }, (prompt, information, name) -> score(prompt), report);
        EvaluationScenario next = new EvaluationScenario("next", scenario.metrics(), "다른 질문", List.of(), "", "");

        runner.evaluate(input, scenario, Map.of(metric.metricType(), metric));
        runner.evaluate(input, next, Map.of(metric.metricType(), metric));
        report.write();

        assertThat(prompts.get(1).getContents()).doesNotContain("웨딩홀은 정했어", "다음 준비는?");
        assertThat(result().path("scenarios").get(1).path("generation").path("calls").size()).isEqualTo(1);
    }

    @Test
    @DisplayName("추천 번호를 읽다가 실패해도 이미 읽은 답변과 번호를 보존한다")
    void preservesPartialAnswerWhenReadingRecommendedIdsFails() throws IOException {
        BibbidiEvaluationReportWriter report = report();
        LocalEvaluationRunner runner = new LocalEvaluationRunner(
                prompt -> response("{\"answer\":\"받은 답변\",\"recommendedItemIds\":[12,1.5]}"),
                (prompt, information, name) -> { throw new AssertionError("Must not judge malformed responses"); }, report);

        assertThatThrownBy(() -> runner.evaluate(input, scenario, Map.of(metric.metricType(), metric)))
                .isInstanceOf(IllegalStateException.class);
        report.write();

        JsonNode recorded = result().path("scenarios").get(0);
        assertThat(recorded.path("generation").path("answer").asText()).isEqualTo("받은 답변");
        assertThat(recorded.path("generation").path("recommendedItemIds").size()).isEqualTo(1);
        assertThat(recorded.path("generation").path("recommendedItemIds").get(0).asLong()).isEqualTo(12);
        assertThat(recorded.path("failure").path("phase").asText()).isEqualTo("generation");
        assertThat(recorded.path("metrics").isEmpty()).isTrue();
    }

    @Test
    @DisplayName("뒤 지표의 채점이 실패해도 앞 지표의 점수와 실패한 지표를 보존한다")
    void preservesCompletedScoresWhenALaterMetricFails() throws IOException {
        MetricInformation nextMetric = new MetricInformation("Relevance", metric.role(), metric.task(), metric.rubric(),
                metric.scale(), metric.direction(), metric.requiredInputs());
        EvaluationScenario twoMetrics = new EvaluationScenario(scenario.name(), List.of("Completeness", "Relevance"),
                scenario.userMessage(), scenario.chatMemory(), scenario.referenceAnswer(), scenario.expectedRefusal());
        IllegalStateException failure = new IllegalStateException("second metric failed");
        BibbidiEvaluationReportWriter report = report();
        LocalEvaluationRunner runner = new LocalEvaluationRunner(
                prompt -> response("{\"answer\":\"받은 답변\",\"recommendedItemIds\":[12]}"),
                (prompt, information, name) -> {
                    if (information.metricType().equals(nextMetric.metricType())) {
                        throw failure;
                    }
                    return score(prompt);
                }, report);

        assertThatThrownBy(() -> runner.evaluate(input, twoMetrics,
                Map.of(metric.metricType(), metric, nextMetric.metricType(), nextMetric))).isSameAs(failure);
        report.write();

        JsonNode recorded = result().path("scenarios").get(0);
        assertThat(recorded.path("generation").path("answer").asText()).isEqualTo("받은 답변");
        assertThat(recorded.path("failure").path("phase").asText()).isEqualTo("metricEvaluation");
        assertThat(recorded.path("failure").path("metricType").asText()).isEqualTo("Relevance");
        assertThat(recorded.path("metrics").size()).isEqualTo(2);
        assertThat(recorded.path("metrics").get(0).path("score").asInt()).isEqualTo(4);
        assertThat(recorded.path("metrics").get(1).path("status").asText()).isEqualTo("error");
        assertThat(result().path("summary").path("completedScenarios").asInt()).isZero();
    }

    @Test
    @DisplayName("프롬프트 구성이 실패해도 모델을 호출하지 않고 생성 실패로 기록한다")
    void recordsPromptFailuresBeforeCallingTheModel() throws IOException {
        EvaluationScenario invalid = new EvaluationScenario(scenario.name(), scenario.metrics(), scenario.userMessage(),
                List.of(new EvaluationScenario.ChatMessage("unknown", "잘못된 역할")), "", "");
        BibbidiEvaluationReportWriter report = report();
        LocalEvaluationRunner runner = new LocalEvaluationRunner(
                prompt -> { throw new AssertionError("Must not call the model for invalid prompts"); },
                (prompt, information, name) -> { throw new AssertionError("Must not judge invalid prompts"); }, report);

        assertThatThrownBy(() -> runner.evaluate(input, invalid, Map.of(metric.metricType(), metric)))
                .isInstanceOf(IllegalArgumentException.class);
        report.write();

        JsonNode recorded = result().path("scenarios").get(0);
        assertThat(recorded.path("failure").path("phase").asText()).isEqualTo("generation");
        assertThat(recorded.path("generation").path("calls").isEmpty()).isTrue();
    }

    private EvaluationResponse score(Prompt prompt) {
        return new EvaluationResponse(false, 4, "채점 이유", Map.of(
                "metricType", metric.metricType(), "rawScore", 4, "qualityPassDetermined", false,
                "judgeInvocation", new JudgeInvocation(prompt.getContents(), "judge output",
                        new ModelTokenUsage(10L, 5L, 15L, null, null, null))));
    }

    private ChatResponse response(String text) {
        return new ChatResponse(List.of(new Generation(new AssistantMessage(text))),
                ChatResponseMetadata.builder().usage(new DefaultUsage(10, 5)).build());
    }

    private BibbidiEvaluationReportWriter report() {
        return new BibbidiEvaluationReportWriter("codex/test", "claude", "test", "medium", directory);
    }

    private JsonNode result() throws IOException {
        return new ObjectMapper().readTree(Files.readString(directory.resolve("result.json")));
    }
}
