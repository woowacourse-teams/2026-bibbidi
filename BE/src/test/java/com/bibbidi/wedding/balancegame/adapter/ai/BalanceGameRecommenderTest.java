package com.bibbidi.wedding.balancegame.adapter.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.balancegame.service.dto.ResolvedBalanceGameAnswer;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.ai.bedrock.converse.BedrockChatOptions;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.core.io.ClassPathResource;
import software.amazon.awssdk.core.exception.ApiCallTimeoutException;
import software.amazon.awssdk.services.bedrockruntime.model.ThrottlingException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class BalanceGameRecommenderTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final ChatModel model = mock(ChatModel.class);
    private final AtomicReference<Prompt> captured = new AtomicReference<>();
    private BalanceGameRecommender recommender;

    @BeforeEach
    void setUp() throws Exception {
        when(model.getOptions()).thenReturn(BedrockChatOptions.builder().model("qwen-default").build());
        ChatClient client = new BalanceGameAiConfig().balanceGameChatClient(
                model, new BalanceGameAiProperties("global.openai.gpt-6.1-sol"),
                new ClassPathResource("prompts/balance-game-system.txt"));
        recommender = new BalanceGameRecommender(client, mapper);
    }

    @Test
    @DisplayName("일반 호출에 전용 Sol 모델·프롬프트·ID 전용 스키마를 적용하고 호출 간 메모리를 공유하지 않는다")
    void shouldUseDedicatedOptionsAndPromptWithoutToolsOrMemory() {
        respond("{\"recommendedItemIds\":[456,123,456]}");
        List<ResolvedBalanceGameAnswer> answers = List.of(
                new ResolvedBalanceGameAnswer(2L, "촬영을 할까?", "UNKNOWN", "아직 잘 모르겠어"));
        List<CatalogItemDetailSnapshot> catalog = List.of(
                new CatalogItemDetailSnapshot(123L, "실제 제목", "실제 카테고리", 3, "실제 단계"));

        assertThat(recommender.recommend(answers, catalog)).containsExactly(456L, 123L, 456L);
        recommender.recommend(answers, catalog);

        Prompt prompt = captured.get();
        assertThat(prompt.getInstructions()).hasSize(2);
        assertThat(prompt.getSystemMessage().getText()).contains(
                "전체 답변을 종합", "catalog 안에서만", "생략한다고 선택한 준비", "UNKNOWN", "불필요로 확정하지",
                "ID 목록 외의 설명");
        JsonNode input = mapper.readTree(prompt.getUserMessage().getText());
        assertThat(input.get("answers").get(0).get("optionId").asString()).isEqualTo("UNKNOWN");
        assertThat(input.get("answers").get(0).get("answer").asString()).isEqualTo("아직 잘 모르겠어");
        assertThat(input.get("catalog").get(0).get("title").asString()).isEqualTo("실제 제목");
        BedrockChatOptions options = (BedrockChatOptions) prompt.getOptions();
        assertThat(options.getModel()).isEqualTo("global.openai.gpt-6.1-sol");
        JsonNode schema = mapper.readTree(options.getOutputSchema());
        assertThat(schema.get("properties").size()).isEqualTo(1);
        assertThat(schema.get("properties").has("recommendedItemIds")).isTrue();
        assertThat(schema.get("required").toString()).contains("recommendedItemIds");
        assertThat(schema.get("additionalProperties").asBoolean()).isFalse();
        assertThat(options.getRequestParameters()).containsKey("text");
        assertThat(options.getToolCallbacks()).isNullOrEmpty();
        verify(model, never()).stream(any(Prompt.class));
    }

    @Test
    @DisplayName("명시적인 빈 ID 배열은 유효한 추천 결과다")
    void shouldAcceptExplicitEmptyArray() {
        respond("{\"recommendedItemIds\":[]}");
        assertThat(recommender.recommend(List.of(), List.of())).isEmpty();
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {
            " ", "null", "[]", "{}", "not-json", "{\"recommendedItemIds\":null}",
            "{\"recommendedItemIds\":\"123\"}", "{\"recommendedItemIds\":[null]}",
            "{\"recommendedItemIds\":[\"123\"]}", "{\"recommendedItemIds\":[1.5]}",
            "{\"recommendedItemIds\":[0]}", "{\"recommendedItemIds\":[-1]}",
            "{\"recommendedItemIds\":[9223372036854775808]}",
            "{\"recommendedItemIds\":[123],\"reason\":\"설명\"}",
            "{\"recommendedItemIds\":[123],\"recommendedItemIds\":[]}",
            "{\"recommendedItemIds\":[123]} {}", "```json\n{\"recommendedItemIds\":[123]}\n```"
    })
    @DisplayName("출력 스키마 위반을 빈 추천 목록으로 바꾸지 않는다")
    void shouldRejectInvalidOutput(String output) {
        respond(output);

        assertThatThrownBy(() -> recommender.recommend(List.of(), List.of()))
                .isInstanceOfSatisfying(BusinessException.class, exception -> {
                    assertThat(exception.clientError()).isEqualTo(ClientError.INTERNAL_ERROR);
                    assertThat(exception.getCause()).isNull();
                })
                .hasMessageNotContaining("not-json")
                .hasMessageNotContaining("9223372036854775808");
    }

    @ParameterizedTest
    @MethodSource("callFailures")
    @DisplayName("AI 오류·타임아웃·스로틀은 기존 오류로 변환하고 공급자 원문을 전달하지 않는다")
    void shouldTranslateCallFailure(RuntimeException failure, ClientError expectedError) {
        when(model.call(any(Prompt.class))).thenThrow(failure);

        assertThatThrownBy(() -> recommender.recommend(List.of(), List.of()))
                .isInstanceOfSatisfying(BusinessException.class, exception -> {
                    assertThat(exception.clientError()).isEqualTo(expectedError);
                    assertThat(exception.getCause()).isNull();
                })
                .hasMessageNotContaining("private-provider-error");
    }

    static Stream<Arguments> callFailures() {
        return Stream.of(
                Arguments.of(new IllegalStateException("private-provider-error"), ClientError.INTERNAL_ERROR),
                Arguments.of(ApiCallTimeoutException.create(60_000), ClientError.INTERNAL_ERROR),
                Arguments.of(new RuntimeException(ThrottlingException.builder()
                        .message("private-provider-error").build()), ClientError.AI_CAPACITY_EXCEEDED));
    }

    private void respond(String output) {
        when(model.call(any(Prompt.class))).thenAnswer(invocation -> {
            captured.set(invocation.getArgument(0));
            return output == null ? new ChatResponse(List.of())
                    : new ChatResponse(List.of(new Generation(new AssistantMessage(output))));
        });
    }
}
