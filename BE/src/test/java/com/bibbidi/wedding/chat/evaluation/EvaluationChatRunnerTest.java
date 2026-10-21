package com.bibbidi.wedding.chat.evaluation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.chat.adapter.ai.AiChatStreamRecorder;
import com.bibbidi.wedding.chat.adapter.ai.BibbidiInMemoryChatMemory;
import com.bibbidi.wedding.chat.adapter.ai.SpringAiConversationAdapter;
import com.bibbidi.wedding.chat.adapter.ai.config.AiChatConfig;
import com.bibbidi.wedding.chat.evaluation.data.EvaluationDataLoader;
import com.bibbidi.wedding.chat.evaluation.data.prep.EvaluationScenario;
import com.bibbidi.wedding.chat.evaluation.data.result.JudgeInvocation;
import com.bibbidi.wedding.chat.evaluation.data.result.ModelTokenUsage;
import com.bibbidi.wedding.chat.evaluation.judge.BibbidiJudge;
import com.bibbidi.wedding.chat.evaluation.report.BibbidiEvaluationReportWriter;
import com.bibbidi.wedding.chat.evaluation.report.RecordingChatModel;
import com.bibbidi.wedding.chat.service.AiChatService;
import com.bibbidi.wedding.chat.service.parser.JacksonChatAnswerParser;
import com.bibbidi.wedding.chat.service.port.CatalogLookupPort;
import com.bibbidi.wedding.chat.service.port.ChecklistLookupPort;
import com.bibbidi.wedding.chat.support.FakeChatModel;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.ai.bedrock.converse.BedrockChatOptions;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.DefaultUsage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.evaluation.EvaluationResponse;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import reactor.core.publisher.Flux;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

class EvaluationChatRunnerTest {

    @TempDir
    Path reportDirectory;

    private final FakeChatModel fakeModel = new FakeChatModel(BedrockChatOptions.builder().build());
    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(AiChatConfig.class, SpringAiConversationAdapter.class, AiChatService.class,
                    JacksonChatAnswerParser.class, PipelineConfiguration.class,
                    BibbidiEvaluationIntegrationTest.ModelRecordingConfiguration.class)
            .withBean(ChatModel.class, () -> fakeModel)
            .withPropertyValues("spring.ai.bedrock.converse.chat.model=test-model",
                    "bibbidi.ai.chatbot.memory-max-messages=20",
                    "bibbidi.ai.chatbot.conversation-idle-timeout=1h",
                    "bibbidi.ai.chatbot.conversation-cleanup-interval=10m");

    @Test
    @DisplayName("55개 추천 시나리오의 110개 평가를 현재 채팅 경로로 실행하고 보고서를 남긴다")
    void evaluatesAllScenariosThroughTheCurrentChatPipeline() {
        fakeModel.respondWith(Flux.just(
                chunk("{\"answer\":\"웨딩홀 투어를 "),
                chunk("추천합니다\",\"recommendedItemIds\":[1]}")));
        contextRunner.run(context -> {
            assertThat(context).hasNotFailed();
            RecordingChatModel model = (RecordingChatModel) context.getBean(ChatModel.class);
            ObjectMapper mapper = context.getBean(ObjectMapper.class);
            BibbidiInMemoryChatMemory memory = context.getBean(BibbidiInMemoryChatMemory.class);
            EvaluationChatRunner runner = new EvaluationChatRunner(context.getBean(AiChatService.class),
                    memory, model, mapper);
            EvaluationDataLoader loader = new EvaluationDataLoader();
            var metrics = loader.loadMetrics().stream().collect(Collectors.toMap(m -> m.metricType(), m -> m));
            var scenarios = loader.loadScenarios();
            assertThat(scenarios).hasSize(55);
            assertThat(scenarios).extracting(EvaluationScenario::name).doesNotHaveDuplicates();
            var assignments = scenarios.stream().flatMap(s -> s.metrics().stream())
                    .collect(Collectors.groupingBy(m -> m, Collectors.counting()));
            assertThat(assignments).hasSize(11).allSatisfy((metric, count) -> assertThat(count).isEqualTo(10));
            AtomicInteger judged = new AtomicInteger();
            BibbidiJudge judge = (prompt, metric, name) -> {
                judged.incrementAndGet();
                assertThat(prompt.getContents()).contains("웨딩홀 투어를 추천합니다");
                int score = metric.scale().getFirst().value();
                return new EvaluationResponse(false, score, "대역 채점", Map.of(
                        "metricType", metric.metricType(), "rawScore", score, "qualityPassDetermined", false,
                        "judgeInvocation", new JudgeInvocation(prompt.getContents(), "대역 응답",
                                ModelTokenUsage.fromSpring(null))));
            };
            BibbidiEvaluationReportWriter report = reportWriter();
            for (EvaluationScenario scenario : scenarios) {
                runner.run(scenario, 7L, Duration.ofSeconds(5));
                assertThat(runner.answer()).isEqualTo("웨딩홀 투어를 추천합니다");
                assertThat(runner.recommendedItemIds()).containsExactly(1L);
                assertThat(runner.providedContext()).singleElement().satisfies(document ->
                        assertThat(document.getText()).contains("웨딩홀 투어", "checklist", "recommendableItemIds"));
                assertThat(memory.conversationCount()).isZero();
                assertThat(model.calls()).hasSize(1);
                assertThat(fakeModel.lastPrompt().getInstructions()).hasSize(scenario.chatMemory().size() + 4);
                assertThat(((BedrockChatOptions) fakeModel.lastPrompt().getOptions()).getOutputSchema()).isNotBlank();
                BibbidiEvaluationRequest request = new BibbidiEvaluationRequest(scenario,
                        runner.providedContext(), runner.answer());
                List<EvaluationResponse> evaluations = new ArrayList<>();
                for (String metric : scenario.metrics()) {
                    evaluations.add(new BibbidiEvaluator(metrics.get(metric), judge).evaluate(request));
                }
                report.record(scenario, model.calls(), runner.answer(), runner.recommendedItemIds(),
                        runner.providedContext(), evaluations);
            }
            report.write();
            var result = mapper.readTree(Files.readString(reportDirectory.resolve("result.json")));
            assertThat(judged).hasValue(110);
            assertThat(fakeModel.callCount()).isZero();
            assertThat(result.path("summary").path("completedScenarios").asInt()).isEqualTo(55);
            assertThat(result.path("summary").path("scoredEvaluations").asInt()).isEqualTo(110);
            var first = result.path("scenarios").get(0);
            assertThat(first.path("generation").path("answer").asText()).isEqualTo("웨딩홀 투어를 추천합니다");
            assertThat(first.path("generation").path("totalTokenUsage").path("totalTokens").asLong()).isEqualTo(15);
            assertThat(first.path("generation").path("recommendedItemIds").get(0).asLong()).isEqualTo(1);
            assertThat(first.has("observedToolCalls")).isFalse();
        });
    }

    @Test
    @DisplayName("모델 응답이 실패해도 부분 답변과 실제 입력을 보고서에 남기고 대화를 정리한다")
    void recordsPartialGenerationAndClearsMemoryOnFailure() {
        fakeModel.respondWith(Flux.concat(Flux.just(chunk("{\"answer\":\"부분 답변")),
                Flux.error(new IllegalStateException("model failed"))));
        contextRunner.run(context -> {
            assertThat(context).hasNotFailed();
            RecordingChatModel model = (RecordingChatModel) context.getBean(ChatModel.class);
            BibbidiInMemoryChatMemory memory = context.getBean(BibbidiInMemoryChatMemory.class);
            ObjectMapper mapper = context.getBean(ObjectMapper.class);
            EvaluationChatRunner runner = new EvaluationChatRunner(context.getBean(AiChatService.class),
                    memory, model, mapper);
            EvaluationScenario scenario = new EvaluationDataLoader().loadScenarios().getFirst();
            assertThatThrownBy(() -> runner.run(scenario, 7L, Duration.ofSeconds(5)))
                    .isInstanceOf(IllegalStateException.class).hasMessage("model failed");
            assertThat(memory.conversationCount()).isZero();
            assertThat(model.calls()).hasSize(1);
            assertThat(runner.providedContext()).isNotEmpty();
            BibbidiEvaluationReportWriter report = reportWriter();
            report.recordFailure(scenario, model.calls(), runner.answer(), runner.recommendedItemIds(),
                    runner.providedContext(), List.of(), "generation", null,
                    new IllegalStateException("model failed"));
            report.write();
            var result = mapper.readTree(Files.readString(reportDirectory.resolve("result.json")));
            var failed = result.path("scenarios").get(0);
            assertThat(failed.path("status").asText()).isEqualTo("error");
            assertThat(failed.path("failure").path("phase").asText()).isEqualTo("generation");
            assertThat(failed.path("generation").path("calls").get(0).path("answer").asText())
                    .contains("부분 답변");
            assertThat(result.path("summary").path("notRunEvaluations").asInt()).isEqualTo(2);
        });
    }

    private BibbidiEvaluationReportWriter reportWriter() {
        return new BibbidiEvaluationReportWriter("fake-model", "fake-judge", "fake", "low", reportDirectory);
    }

    private ChatResponse chunk(String text) {
        return new ChatResponse(List.of(new Generation(new AssistantMessage(text))),
                ChatResponseMetadata.builder().usage(new DefaultUsage(10, 5)).build());
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class PipelineConfiguration {

        @Bean
        ChatClient.Builder chatClientBuilder(ChatModel model) {
            return ChatClient.builder(model);
        }

        @Bean
        ChatMemoryRepository chatMemoryRepository() {
            return new InMemoryChatMemoryRepository();
        }

        @Bean
        CatalogLookupPort catalogLookupPort() {
            CatalogLookupPort catalog = mock(CatalogLookupPort.class);
            when(catalog.findAllItemDetails())
                    .thenReturn(List.of(new CatalogItemDetailSnapshot(1L, "웨딩홀", "웨딩홀 투어", 1, "후보")));
            return catalog;
        }

        @Bean
        ChecklistLookupPort checklistLookupPort() {
            ChecklistLookupPort checklist = mock(ChecklistLookupPort.class);
            when(checklist.findMyChecklistIfPresent(7L)).thenReturn(Optional.empty());
            when(checklist.filterRecommendableCatalogItemIds(eq(7L), anyList()))
                    .thenAnswer(invocation -> invocation.getArgument(1));
            return checklist;
        }

        @Bean
        AiChatStreamRecorder aiChatStreamRecorder() {
            return new AiChatStreamRecorder(new SimpleMeterRegistry(), "fake-model");
        }

        @Bean
        ObjectMapper mapper() {
            return JsonMapper.builder().findAndAddModules().build();
        }
    }
}
