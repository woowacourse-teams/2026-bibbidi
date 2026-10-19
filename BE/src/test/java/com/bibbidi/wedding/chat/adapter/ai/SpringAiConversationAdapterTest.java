package com.bibbidi.wedding.chat.adapter.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.chat.service.dto.prompt.BibbidiCustomChatPromptContext;
import com.bibbidi.wedding.chat.service.dto.prompt.ChecklistItemSnapshot;
import com.bibbidi.wedding.chat.service.dto.prompt.ChecklistSnapshot;
import com.bibbidi.wedding.chat.service.dto.result.AiResponseStream;
import com.bibbidi.wedding.chat.support.AiChatStreamRecorderFixture;
import com.bibbidi.wedding.chat.support.FakeChatModel;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.DefaultUsage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import reactor.core.publisher.Flux;
import software.amazon.awssdk.services.bedrockruntime.model.ThrottlingException;
import tools.jackson.databind.json.JsonMapper;

class SpringAiConversationAdapterTest {

    private static final String CONVERSATION = "7:7bf4d204-8331-439b-bd8f-271abc0eea99";

    private FakeChatModel model;
    private BibbidiInMemoryChatMemory memory;
    private SpringAiConversationAdapter adapter;
    private SimpleMeterRegistry registry;

    @BeforeEach
    void setUp() {
        registry = new SimpleMeterRegistry();
        model = new FakeChatModel();
        memory = new BibbidiInMemoryChatMemory(new InMemoryChatMemoryRepository(), 18);
        adapter = new SpringAiConversationAdapter(ChatClient.create(model), memory,
                JsonMapper.builder().findAndAddModules().build(), AiChatStreamRecorderFixture.create(registry));
    }

    @Test
    @DisplayName("이전 대화, 준비 정보, 카탈로그, 사용자 질문 순서로 모델에 전달한다")
    void sendsHistoryContextAndQuestionToTheModelInOrder() {
        // given
        memory.add(CONVERSATION, List.of(new UserMessage("예산은 1000"), new AssistantMessage("알겠습니다.")));
        model.respondWith(Flux.just(chunk("답변")));

        // when
        adapter.stream(CONVERSATION, "추천해줘", context()).content().blockLast();

        // then
        List<Message> instructions = model.lastPrompt().getInstructions();
        assertThat(instructions).extracting(Message::getText).hasSize(5)
                .startsWith("예산은 1000", "알겠습니다.")
                .endsWith("추천해줘");
        assertThat(instructions.get(2).getText()).contains("\"checklist\"", "웨딩홀 예약", "\"recommendableItemIds\"");
        assertThat(instructions.get(3).getText()).contains("\"catalog\"", "웨딩홀 후보 정하기");
    }

    @Test
    @DisplayName("모델이 보낸 답변 조각과 추천 가능한 항목 ID를 그대로 돌려준다")
    void returnsTheModelContentAndRecommendableItemIds() {
        // given
        model.respondWith(Flux.just(chunk("웨딩홀 "), chunk("계약")));

        // when
        AiResponseStream response = adapter.stream(CONVERSATION, "질문", context());

        // then
        assertThat(response.content().collectList().block()).containsExactly("웨딩홀 ", "계약");
        assertThat(response.recommendableItemIds()).containsExactlyInAnyOrder(2L, 3L);
    }

    @Test
    @DisplayName("호출할 때마다 대화에 연결한 준비 정보를 최신 값으로 바꾼다")
    void replacesThePromptContextOnEveryStream() {
        // given
        BibbidiCustomChatPromptContext latest = new BibbidiCustomChatPromptContext(
                ChecklistSnapshot.notFound(), List.of(), Set.of());
        model.respondWith(Flux.just(chunk("답변")));
        adapter.stream(CONVERSATION, "첫 질문", context()).content().blockLast();

        // when
        adapter.stream(CONVERSATION, "둘째 질문", latest).content().blockLast();

        // then
        assertThat(memory.bibbidiCustomContext(CONVERSATION)).isEqualTo(latest);
        assertThat(model.lastPrompt().getInstructions().get(0).getText()).contains("\"exists\":false");
    }

    @Test
    @DisplayName("질문과 답변을 한 쌍으로 대화 기록에 저장한다")
    void remembersTheQuestionAndAnswerAsAPair() {
        // when
        adapter.remember(CONVERSATION, "질문", "답변");

        // then
        assertThat(memory.get(CONVERSATION)).extracting(Message::getText).containsExactly("질문", "답변");
        assertThat(memory.get(CONVERSATION)).extracting(Message::getMessageType)
                .extracting(Enum::name).containsExactly("USER", "ASSISTANT");
    }

    @Test
    @DisplayName("답변을 마치면 완료한 대화 수를 기록한다")
    void recordsCompletedTurnWhenTheAnswerCompletes() {
        // given
        model.respondWith(Flux.just(chunk("웨딩홀 "), chunk("계약"), usageOnly(1_000_000, 500_000)));

        // when
        adapter.stream(CONVERSATION, "질문", context()).content().blockLast();

        // then
        assertThat(registry.get("ai.chat.turns").counter().count()).isEqualTo(1);
        assertThat(registry.get("ai.chat.completed").counter().count()).isEqualTo(1);
        assertThat(registry.get("ai.chat.cancelled").counter().count()).isZero();
        assertThat(failureCount("throttled") + failureCount("timeout") + failureCount("error")).isZero();
    }

    @Test
    @DisplayName("답변 도중 모델이 실패하면 실패 횟수를 기록한다")
    void recordsFailureWhenTheModelFails() {
        // given
        model.respondWith(Flux.concat(Flux.just(chunk("웨딩홀 ")), Flux.error(new IllegalStateException("모델 오류"))));

        // when
        adapter.stream(CONVERSATION, "질문", context()).content().collectList().onErrorReturn(List.of()).block();

        // then
        assertThat(failureCount("error")).isEqualTo(1);
        assertThat(failureCount("throttled")).isZero();
        assertThat(failureCount("timeout")).isZero();
        assertThat(registry.get("ai.chat.turns").counter().count()).isEqualTo(1);
        assertThat(registry.get("ai.chat.completed").counter().count()).isZero();
        assertThat(registry.get("ai.chat.cancelled").counter().count()).isZero();
    }

    @Test
    @DisplayName("모델 호출 한도를 넘으면 한도 초과 예외로 바꾼다")
    void convertsThrottlingToCapacityExceeded() {
        // given
        ThrottlingException throttling = ThrottlingException.builder().message("Too many requests").build();
        model.respondWith(Flux.error(throttling));

        // when, then
        assertThatThrownBy(() -> adapter.stream(CONVERSATION, "질문", context()).content().blockLast())
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.clientError()).isEqualTo(ClientError.AI_CAPACITY_EXCEEDED))
                .hasCause(throttling);
    }

    @Test
    @DisplayName("한도 초과가 아닌 모델 실패는 그대로 전달한다")
    void keepsOtherModelFailures() {
        // given
        IllegalStateException failure = new IllegalStateException("모델 오류");
        model.respondWith(Flux.error(failure));

        // when, then
        assertThatThrownBy(() -> adapter.stream(CONVERSATION, "질문", context()).content().blockLast())
                .isSameAs(failure);
    }

    @Test
    @DisplayName("모델이 한도 초과로 실패하면 throttled 사유로 기록한다")
    void recordsThrottledFailureWhenTheModelIsThrottled() {
        // given
        model.respondWith(Flux.error(ThrottlingException.builder().message("Too many tokens").build()));

        // when
        adapter.stream(CONVERSATION, "질문", context()).content().collectList().onErrorReturn(List.of()).block();

        // then
        assertThat(failureCount("throttled")).isEqualTo(1);
        assertThat(failureCount("timeout")).isZero();
        assertThat(failureCount("error")).isZero();
    }

    @Test
    @DisplayName("모델 응답이 시간 초과로 실패하면 timeout 사유로 기록한다")
    void recordsTimeoutFailureWhenTheModelTimesOut() {
        // given
        model.respondWith(Flux.error(new TimeoutException("응답 시간 초과")));

        // when
        adapter.stream(CONVERSATION, "질문", context()).content().collectList().onErrorReturn(List.of()).block();

        // then
        assertThat(failureCount("timeout")).isEqualTo(1);
        assertThat(failureCount("throttled")).isZero();
        assertThat(failureCount("error")).isZero();
    }

    @Test
    @DisplayName("답변 스트림이 취소되면 취소 횟수를 기록한다")
    void recordsCancellationWhenTheAnswerStreamIsCancelled() {
        // given
        model.respondWith(Flux.concat(Flux.just(chunk("답변")), Flux.never()));

        // when
        adapter.stream(CONVERSATION, "질문", context()).content().take(1).blockLast();

        // then
        assertThat(registry.get("ai.chat.turns").counter().count()).isEqualTo(1);
        assertThat(registry.get("ai.chat.completed").counter().count()).isZero();
        assertThat(registry.get("ai.chat.cancelled").counter().count()).isEqualTo(1);
        assertThat(failureCount("throttled") + failureCount("timeout") + failureCount("error")).isZero();
    }

    @Test
    @DisplayName("토큰 사용량만 담긴 조각은 답변 조각으로 전달하지 않는다")
    void doesNotForwardChunksWithoutText() {
        // given
        model.respondWith(Flux.just(chunk("답변"), usageOnly(10, 5)));

        // when
        List<String> content = adapter.stream(CONVERSATION, "질문", context()).content().collectList().block();

        // then
        assertThat(content).containsExactly("답변");
    }

    private static ChatResponse usageOnly(int inputTokens, int outputTokens) {
        return new ChatResponse(
                List.of(new Generation(new AssistantMessage(""))),
                ChatResponseMetadata.builder().usage(new DefaultUsage(inputTokens, outputTokens)).build());
    }

    private static BibbidiCustomChatPromptContext context() {
        ChecklistSnapshot checklist = new ChecklistSnapshot(true, List.of(
                new ChecklistItemSnapshot(1L, 1L, "웨딩홀 예약", "TODO", List.of())));
        List<CatalogItemDetailSnapshot> catalog = List.of(
                new CatalogItemDetailSnapshot(1L, "웨딩홀 후보 정하기", "웨딩홀", 1, "후보"),
                new CatalogItemDetailSnapshot(2L, "스튜디오 후보 정하기", "촬영", 1, "후보"));
        return new BibbidiCustomChatPromptContext(checklist, catalog, Set.of(2L, 3L));
    }

    private static ChatResponse chunk(String text) {
        return new ChatResponse(List.of(new Generation(new AssistantMessage(text))));
    }

    private double failureCount(String reason) {
        return registry.get("ai.chat.failures").tag("reason", reason).counter().count();
    }
}
