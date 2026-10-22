package com.bibbidi.wedding.chat.evaluation;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.chat.evaluation.data.EvaluationDataLoader;
import com.bibbidi.wedding.chat.evaluation.report.RecordingChatModel;
import com.bibbidi.wedding.chat.service.AiChatService;
import com.bibbidi.wedding.chat.support.FakeChatModel;
import java.time.Duration;
import java.util.List;
import javax.sql.DataSource;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.bedrock.converse.BedrockChatOptions;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.ToolResponseMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import reactor.core.publisher.Flux;

@SpringBootTest
@ActiveProfiles({"test", "evaluator"})
@Import({BibbidiEvaluationIntegrationTest.ModelRecordingConfiguration.class,
        EvaluationContextIntegrationTest.FakeModelConfiguration.class})
@Sql({"/load_catalog.sql", "/ai-evaluation/evaluation-user.sql"})
class EvaluationContextIntegrationTest {

    @Autowired
    private AiChatService service;

    @Autowired
    private ChatMemory memory;

    @Autowired
    private ChatModel model;

    @Autowired
    private DataSource dataSource;

    @Test
    @DisplayName("평가 프로필에서 실제 DB 조회와 채팅 설정을 연결해 답변과 추천 결과를 수집한다")
    void runsTheEvaluationProfileWithRealCatalogAndChecklistLookups() throws Exception {
        try (var connection = dataSource.getConnection()) {
            assertThat(connection.getMetaData().getURL()).startsWith("jdbc:h2:mem:bibbidi-evaluation");
        }
        assertThat(model).isInstanceOf(RecordingChatModel.class);
        EvaluationChatRunner runner = new EvaluationChatRunner(service, memory, (RecordingChatModel) model);
        runner.run(new EvaluationDataLoader().loadScenarios().getFirst(), 900001L, Duration.ofSeconds(10));
        assertThat(runner.answer()).isEqualTo("예식 지역을 정하고 웨딩홀 투어를 준비하세요.");
        assertThat(runner.recommendedItemIds()).containsExactly(1L);
        assertThat(runner.providedContext()).hasSize(2);
        assertThat(runner.providedContext().getFirst().getText()).contains("\"exists\"");
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class FakeModelConfiguration {

        @Bean
        @Primary
        ChatModel chatModel() {
            return new FakeChatModel(BedrockChatOptions.builder().build(), prompt -> {
                boolean toolsAnswered = prompt.getInstructions().stream().anyMatch(ToolResponseMessage.class::isInstance);
                if (toolsAnswered) {
                    return Flux.just(new ChatResponse(List.of(new Generation(new AssistantMessage(
                            "{\"answer\":\"예식 지역을 정하고 웨딩홀 투어를 준비하세요.\",\"recommendedItemIds\":[1]}")))));
                }
                AssistantMessage toolCalls = AssistantMessage.builder()
                        .content("")
                        .toolCalls(List.of(
                                new AssistantMessage.ToolCall("call-1", "function", "getMyChecklist", "{}"),
                                new AssistantMessage.ToolCall("call-2", "function", "getRecommendableItemIds", "{}")))
                        .build();
                return Flux.just(new ChatResponse(List.of(new Generation(toolCalls))));
            });
        }
    }
}
