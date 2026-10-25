package com.bibbidi.wedding.chat.adapter.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;
import static org.mockito.Mockito.mock;

import com.bibbidi.wedding.chat.adapter.ai.parser.JacksonChatAnswerParser;
import com.bibbidi.wedding.chat.adapter.ai.routing.ModelClassifier;
import com.bibbidi.wedding.chat.service.dto.result.ChatResult;
import com.bibbidi.wedding.chat.support.FakeChatModel;
import com.bibbidi.wedding.chat.support.SpringAiChatClientFixture;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Function;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.DefaultUsage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.model.tool.ToolCallingChatOptions;
import reactor.core.Disposable;
import reactor.core.publisher.Flux;
import reactor.test.publisher.TestPublisher;
import software.amazon.awssdk.services.bedrockruntime.model.ThrottlingException;
import tools.jackson.databind.json.JsonMapper;

class SpringAiConversationAdapterTest {

    private static final Long USER_ID = 7L;
    private static final String CONVERSATION = "7:7bf4d204-8331-439b-bd8f-271abc0eea99";
    private static final String ANOTHER_CONVERSATION = "8:7bf4d204-8331-439b-bd8f-271abc0eea99";
    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    private final List<Prompt> receivedPrompts = new CopyOnWriteArrayList<>();
    private volatile Function<Prompt, Flux<ChatResponse>> responder = _ -> Flux.empty();
    private ChatMemory chatMemory;
    private SpringAiConversationAdapter springAiConversationAdapter;

    @BeforeEach
    void setUp() {
        FakeChatModel model = new FakeChatModel(prompt -> {
            receivedPrompts.add(prompt);
            return responder.apply(prompt);
        });
        chatMemory = MessageWindowChatMemory.builder()
                .chatMemoryRepository(new InMemoryChatMemoryRepository())
                .maxMessages(18)
                .build();
        springAiConversationAdapter = new SpringAiConversationAdapter(SpringAiChatClientFixture.create(model,
                chatMemory), new JacksonChatAnswerParser(MAPPER), mock(ModelClassifier.class), "qwen");
    }

    @Test
    @DisplayName("이전 대화와 사용자 질문을 모델에 전달한다")
    void sendsHistoryContextAndQuestionToTheModelInOrder() {
        // given
        chatMemory.add(CONVERSATION, List.of(new UserMessage("예산은 1000"), new AssistantMessage("알겠습니다.")));
        respondWith(Flux.just(chunk(answerJson("답변"))));

        // when
        springAiConversationAdapter.stream(USER_ID, CONVERSATION, "추천해줘").blockLast();

        // then
        List<Message> instructions = receivedPrompts.getLast().getInstructions();
        assertThat(instructions).extracting(Message::getText).containsExactly("예산은 1000", "알겠습니다.", "추천해줘");
    }

    @Test
    @DisplayName("모델이 보낸 답변 조각을 그대로 돌려준다")
    void returnsTheModelContent() {
        // given
        respondWith(Flux.just(chunk("{\"answer\":\"웨딩홀 "), chunk("계약\",\"recommendedItemIds\":[]}")));

        // when
        List<ChatResult> content = springAiConversationAdapter.stream(USER_ID, CONVERSATION, "질문")
                .collectList().block();

        // then
        assertThat(content).containsExactly(
                new ChatResult.Selected("test-model"),
                new ChatResult.Delta("웨딩홀 "),
                new ChatResult.Delta("계약"),
                new ChatResult.Answer("웨딩홀 계약", List.of()));
    }

    @Test
    @DisplayName("도구 호출에 요청한 사용자의 ID를 전달한다")
    void passesTheRequestingUserIdToTheToolContext() {
        // given
        respondWith(Flux.just(chunk(answerJson("답변"))));

        // when
        springAiConversationAdapter.stream(USER_ID, CONVERSATION, "질문").blockLast();

        // then
        ToolCallingChatOptions options = (ToolCallingChatOptions) receivedPrompts.getLast().getOptions();
        assertThat(options.getToolContext()).containsEntry("userId", USER_ID);
    }

    @Test
    @DisplayName("다음 호출에서 Advisor가 앞선 대화 기록을 전달한다")
    void passesEarlierTurnsOfTheSameConversation() {
        // given
        respondWith(Flux.just(chunk(answerJson("답변"))));
        springAiConversationAdapter.stream(USER_ID, CONVERSATION, "첫 질문").blockLast();

        // when
        springAiConversationAdapter.stream(USER_ID, CONVERSATION, "둘째 질문").blockLast();

        // then
        assertThat(receivedPrompts.getLast().getInstructions()).extracting(Message::getText)
                .containsExactly("첫 질문", answerJson("답변"), "둘째 질문");
    }

    @Test
    @DisplayName("질문과 답변을 한 쌍으로 대화 기록에 저장한다")
    void remembersTheQuestionAndAnswerAsAPair() {
        // when
        respondWith(Flux.just(chunk(answerJson("답변"))));
        springAiConversationAdapter.stream(USER_ID, CONVERSATION, "질문").blockLast();

        // then
        assertThat(chatMemory.get(CONVERSATION)).extracting(Message::getText)
                .containsExactly("질문", answerJson("답변"));
        assertThat(chatMemory.get(CONVERSATION)).extracting(Message::getMessageType)
                .extracting(Enum::name).containsExactly("USER", "ASSISTANT");
    }

    @Test
    @DisplayName("모델 호출 한도를 넘으면 한도 초과 예외로 바꾼다")
    void convertsThrottlingToCapacityExceeded() {
        // given
        ThrottlingException throttling = ThrottlingException.builder().message("Too many requests").build();
        respondWith(Flux.error(throttling));

        // when, then
        assertThatThrownBy(() -> springAiConversationAdapter.stream(USER_ID, CONVERSATION, "질문").blockLast())
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.clientError()).isEqualTo(ClientError.AI_CAPACITY_EXCEEDED))
                .hasCause(throttling);
    }

    @Test
    @DisplayName("한도 초과가 아닌 모델 실패는 그대로 전달한다")
    void keepsOtherModelFailures() {
        // given
        IllegalStateException failure = new IllegalStateException("모델 오류");
        respondWith(Flux.error(failure));

        // when, then
        assertThatThrownBy(() -> springAiConversationAdapter.stream(USER_ID, CONVERSATION, "질문").blockLast())
                .isSameAs(failure);
    }

    @Test
    @DisplayName("토큰 사용량만 담긴 조각은 답변 조각으로 전달하지 않는다")
    void doesNotForwardChunksWithoutText() {
        // given
        respondWith(Flux.just(chunk(answerJson("답변")), usageOnly(10, 5)));

        // when
        List<ChatResult> content = springAiConversationAdapter.stream(USER_ID, CONVERSATION, "질문")
                .collectList().block();

        // then
        assertThat(content).containsExactly(
                new ChatResult.Selected("test-model"),
                new ChatResult.Delta("답변"),
                new ChatResult.Answer("답변", List.of()));
    }

    @Test
    @DisplayName("다른 대화 키의 기록은 모델에 전달하지 않는다")
    void doesNotSendHistoryOfAnotherConversationKey() {
        // given
        chatMemory.add(CONVERSATION, List.of(new UserMessage("예산은 1000"), new AssistantMessage("알겠습니다.")));
        respondWith(Flux.just(chunk(answerJson("답변"))));

        // when
        springAiConversationAdapter.stream(USER_ID, ANOTHER_CONVERSATION, "추천해줘").blockLast();

        // then
        assertThat(receivedPrompts.getLast().getInstructions()).extracting(Message::getText)
                .containsExactly("추천해줘");
    }

    @Test
    @DisplayName("중괄호가 포함된 사용자 메시지를 원문 그대로 전달한다")
    void userTextWithBracesIsPassedAsLiteralContent() {
        // given
        String question = "예산 {예산}과 조건 {\"촬영\":false}를 참고해줘";
        respondWith(Flux.just(chunk(answerJson("확인했어요."))));

        // when
        springAiConversationAdapter.stream(USER_ID, CONVERSATION, question).blockLast();

        // then
        assertThat(receivedPrompts.getLast().getInstructions().getLast().getText()).isEqualTo(question);
    }

    @Test
    @DisplayName("질문은 먼저 저장하고 모델 답변은 완료한 뒤에 저장한다")
    void remembersTheQuestionFirstAndTheAnswerOnlyOnCompletion() {
        // given
        TestPublisher<ChatResponse> publisher = TestPublisher.create();
        respondWith(publisher.flux());
        springAiConversationAdapter.stream(USER_ID, CONVERSATION, "질문").subscribe();
        await().untilAsserted(() -> publisher.assertSubscribers(1));

        // when
        publisher.next(chunk("{\"answer\":\"웨딩홀 "));

        // then
        assertThat(chatMemory.get(CONVERSATION)).extracting(Message::getText).containsExactly("질문");

        // when
        publisher.next(chunk("계약\",\"recommendedItemIds\":[]}")).complete();

        // then
        await().untilAsserted(() -> assertThat(chatMemory.get(CONVERSATION)).extracting(Message::getText)
                .containsExactly("질문", answerJson("웨딩홀 계약")));
    }

    @Test
    @DisplayName("답변 도중 모델이 실패하면 부분 답변을 저장하지 않는다")
    void doesNotRememberAPartialAnswerWhenTheModelFails() {
        // given
        TestPublisher<ChatResponse> publisher = TestPublisher.create();
        respondWith(publisher.flux());
        springAiConversationAdapter.stream(USER_ID, CONVERSATION, "질문").subscribe(ignored -> {
        }, ignored -> {
        });
        await().untilAsserted(() -> publisher.assertSubscribers(1));

        // when
        publisher.next(chunk("일부 답변"));
        publisher.error(new IllegalStateException("모델 오류"));

        // then
        assertThat(chatMemory.get(CONVERSATION)).extracting(Message::getText).containsExactly("질문");
    }

    @Test
    @DisplayName("구독을 취소하면 늦게 도착한 답변도 저장하지 않는다")
    void doesNotRememberAnswersAfterCancellation() {
        // given
        TestPublisher<ChatResponse> publisher = TestPublisher.createNoncompliant(
                TestPublisher.Violation.DEFER_CANCELLATION);
        respondWith(publisher.flux());
        Disposable subscription = springAiConversationAdapter.stream(USER_ID, CONVERSATION, "질문").subscribe();
        await().untilAsserted(() -> publisher.assertSubscribers(1));
        publisher.next(chunk("일부 답변"));

        // when
        subscription.dispose();
        publisher.next(chunk("늦은 답변")).complete();

        // then
        publisher.assertCancelled();
        assertThat(chatMemory.get(CONVERSATION)).extracting(Message::getText).containsExactly("질문");
    }

    private static ChatResponse usageOnly(int inputTokens, int outputTokens) {
        return new ChatResponse(
                List.of(new Generation(new AssistantMessage(""))),
                ChatResponseMetadata.builder().usage(new DefaultUsage(inputTokens, outputTokens)).build());
    }

    private static ChatResponse chunk(String text) {
        return new ChatResponse(List.of(new Generation(new AssistantMessage(text))));
    }

    private static String answerJson(String text) {
        return MAPPER.writeValueAsString(new ChatResult.Answer(text, List.of()));
    }

    private void respondWith(Flux<ChatResponse> response) {
        responder = prompt -> response;
    }
}
