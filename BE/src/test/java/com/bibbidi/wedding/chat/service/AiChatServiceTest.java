package com.bibbidi.wedding.chat.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.chat.infra.ai.BibbidiChatMemory;
import com.bibbidi.wedding.chat.service.dto.ChatAnswer;
import com.bibbidi.wedding.chat.service.dto.ChatResult;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CancellationException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Named;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.model.tool.ToolCallingChatOptions;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import reactor.core.publisher.Flux;
import reactor.test.publisher.TestPublisher;
import tools.jackson.databind.json.JsonMapper;

class AiChatServiceTest {

    private static final Long USER_ID = 7L;
    private static final Long ANOTHER_USER_ID = 8L;
    private static final UUID CONVERSATION_ID = UUID.fromString("7bf4d204-8331-439b-bd8f-271abc0eea99");
    private static final UUID ANOTHER_CONVERSATION_ID = UUID.fromString("7bf4d204-8331-439b-bd8f-271abc0eea98");

    private ChatModel model;
    private ChatMemory memory;
    private AiChatService service;
    private ChatSseHandler reply;
    private ChecklistService checklistService;
    private ExecutorService executor;
    private AtomicBoolean responseFinished;

    @BeforeEach
    void setUp() {
        model = mock(ChatModel.class);
        when(model.getOptions()).thenReturn(ToolCallingChatOptions.builder().build());
        ChatMemoryRepository repository = new InMemoryChatMemoryRepository();
        memory = MessageWindowChatMemory.builder().chatMemoryRepository(repository).maxMessages(18).build();
        checklistService = mock(ChecklistService.class);
        JsonMapper mapper = JsonMapper.builder().findAndAddModules().build();
        ChatMemory bibbidiMemory = new BibbidiChatMemory(repository, 20, mock(CatalogService.class),
                checklistService, mapper);
        service = new AiChatService(ChatClient.create(model), bibbidiMemory, checklistService, mapper);
        executor = Executors.newVirtualThreadPerTaskExecutor();
        responseFinished = new AtomicBoolean();
        reply = mock(ChatSseHandler.class);
        doAnswer(invocation -> {
            Runnable rememberTurn = invocation.getArgument(1);
            rememberTurn.run();
            return null;
        }).when(reply).complete(any(ChatResult.class), any(Runnable.class));
    }

    @AfterEach
    void tearDown() {
        executor.shutdownNow();
        executor.close();
    }

    @Test
    @DisplayName("답변을 조각별로 전달하고 완료된 대화만 저장한다")
    void streamsChunksAndRecordsOnlyTheCompletedTurn() throws Exception {
        // given
        TestPublisher<ChatResponse> publisher = TestPublisher.create();
        Future<?> responseTask = startStreamingChat(publisher);

        // when, then: 답변 조각을 받는 동안에는 대화를 저장하지 않는다
        publisher.next(chunk("{\"answer\":\"웨딩홀 "));
        await().untilAsserted(() -> verify(reply).sendAnswerChunk("웨딩홀 "));
        assertThat(memory.get(USER_ID + ":" + CONVERSATION_ID)).isEmpty();
        publisher.next(chunk("계약을 확인하세요.\",\"recommendedItemIds\":[]}"));
        await().untilAsserted(() -> verify(reply).sendAnswerChunk("계약을 확인하세요."));

        // when
        publisher.complete();
        responseTask.get(5, TimeUnit.SECONDS);

        // then
        assertThat(memory.get(USER_ID + ":" + CONVERSATION_ID))
                .extracting(message -> message.getText())
                .containsExactly("질문", "웨딩홀 계약을 확인하세요.");
    }

    @Test
    @DisplayName("대화 ID가 없으면 새 UUID를 생성해 전달한다")
    void generatesAnIdForANewConversation() {
        // given
        when(model.stream(any(Prompt.class))).thenReturn(Flux.just(response("답변")));

        // when
        service.chat(USER_ID, null, "질문", reply);

        // then
        ArgumentCaptor<String> conversationId = ArgumentCaptor.forClass(String.class);
        verify(reply).conversation(conversationId.capture());
        UUID generatedId = UUID.fromString(conversationId.getValue());
        assertThat(conversationId.getValue()).isEqualTo(generatedId.toString());
    }

    @Test
    @DisplayName("인증된 사용자로 최신 정보를 준비하고 모델에는 도구를 전달하지 않는다")
    void loadsTheAuthenticatedUsersContextWithoutTools() {
        // given
        when(model.stream(any(Prompt.class))).thenReturn(Flux.just(response("답변")));

        // when
        service.chat(USER_ID, CONVERSATION_ID, "질문", reply);

        // then
        Prompt prompt = captureModelPrompt();
        ToolCallingChatOptions options = (ToolCallingChatOptions) prompt.getOptions();
        verify(checklistService).findMyChecklistIfPresent(USER_ID);
        assertThat(options.getToolCallbacks()).isNullOrEmpty();
        assertThat(options.getToolContext()).isNullOrEmpty();
    }

    @Test
    @DisplayName("모델 호출 시 활성 트랜잭션이 없다")
    void callsTheModelWithoutAnActiveTransaction() throws Exception {
        // given
        AtomicBoolean transactionActive = new AtomicBoolean(true);
        when(model.stream(any(Prompt.class))).thenAnswer(invocation -> {
            transactionActive.set(TransactionSynchronizationManager.isActualTransactionActive());
            return Flux.just(response("답변"));
        });

        // when
        Future<?> responseTask = executor.submit(() -> service.chat(USER_ID, CONVERSATION_ID, "질문", reply));
        responseTask.get(5, TimeUnit.SECONDS);

        // then
        assertThat(transactionActive.get()).isFalse();
    }

    @Test
    @DisplayName("같은 사용자의 같은 대화에서는 이전 대화 기록을 사용한다")
    void reusesHistoryForTheSameUserAndConversation() {
        // given
        givenConversationHistory();
        when(model.stream(any(Prompt.class))).thenReturn(Flux.just(response("답변")));

        // when
        service.chat(USER_ID, CONVERSATION_ID, "추천해줘", reply);

        // then
        Prompt prompt = captureModelPrompt();
        assertThat(prompt.getInstructions())
                .extracting(message -> message.getText())
                .hasSize(5).startsWith("예산은 1000", "알겠습니다.").endsWith("추천해줘");
    }

    @Test
    @DisplayName("대화 ID가 같아도 다른 사용자의 대화 기록은 사용하지 않는다")
    void doesNotReuseAnotherUsersHistory() {
        // given
        givenConversationHistory();
        when(model.stream(any(Prompt.class))).thenReturn(Flux.just(response("답변")));

        // when
        service.chat(ANOTHER_USER_ID, CONVERSATION_ID, "추천해줘", reply);

        // then
        Prompt prompt = captureModelPrompt();
        assertThat(prompt.getInstructions())
                .extracting(message -> message.getText())
                .hasSize(3).endsWith("추천해줘").doesNotContain("예산은 1000", "알겠습니다.");
    }

    @Test
    @DisplayName("사용자가 같아도 다른 대화의 기록은 사용하지 않는다")
    void doesNotReuseAnotherConversationsHistory() {
        // given
        givenConversationHistory();
        when(model.stream(any(Prompt.class))).thenReturn(Flux.just(response("답변")));

        // when
        service.chat(USER_ID, ANOTHER_CONVERSATION_ID, "추천해줘", reply);

        // then
        Prompt prompt = captureModelPrompt();
        assertThat(prompt.getInstructions())
                .extracting(message -> message.getText())
                .hasSize(3).endsWith("추천해줘").doesNotContain("예산은 1000", "알겠습니다.");
    }

    @Test
    @DisplayName("중괄호가 포함된 사용자 메시지를 원문 그대로 전달한다")
    void userTextWithBracesIsPassedAsLiteralContent() {
        // given
        String question = "예산 {예산}과 조건 {\"촬영\":false}를 참고해줘";
        when(model.stream(any(Prompt.class))).thenReturn(Flux.just(response("확인했어요.")));

        // when
        service.chat(USER_ID, null, question, reply);

        // then
        Prompt prompt = captureModelPrompt();
        assertThat(prompt.getInstructions().getLast().getText()).isEqualTo(question);
        verify(reply).sendAnswerChunk("확인했어요.");
    }

    @Test
    @DisplayName("답변 생성이 실패하면 부분 답변을 저장하지 않고 같은 대화로 재요청할 수 있다")
    void errorsDoNotRecordPartialAnswersAndReleaseTheConversation() {
        // given
        TestPublisher<ChatResponse> publisher = TestPublisher.create();
        Future<?> responseTask = startStreamingChat(publisher);

        // when
        publisher.next(chunk("{\"answer\":\"일부 답변"));
        await().untilAsserted(() -> verify(reply).sendAnswerChunk("일부 답변"));
        publisher.error(new IllegalStateException("비공개 제공사 오류"));

        // then
        assertThatThrownBy(() -> responseTask.get(5, TimeUnit.SECONDS))
                .hasCauseInstanceOf(IllegalStateException.class);
        assertThat(memory.get(USER_ID + ":" + CONVERSATION_ID)).isEmpty();

        // given
        when(model.stream(any(Prompt.class))).thenReturn(Flux.just(response("새 답변")));

        // when
        service.chat(USER_ID, CONVERSATION_ID, "다시 질문", reply);

        // then
        assertThat(memory.get(USER_ID + ":" + CONVERSATION_ID))
                .extracting(message -> message.getText())
                .containsExactly("다시 질문", "새 답변");
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("emptyAnswers")
    @DisplayName("답변이 비어 있거나 공백뿐이면 예외를 던지고 대화를 저장하지 않는다")
    void emptyOrBlankAnswersDoNotRecordATurn(Flux<ChatResponse> answer) {
        // given
        when(model.stream(any(Prompt.class))).thenReturn(answer);

        // when, then
        assertThatThrownBy(() -> service.chat(USER_ID, CONVERSATION_ID, "질문", reply))
                .isInstanceOfSatisfying(BusinessException.class,
                        exception -> assertThat(exception.clientError()).isEqualTo(ClientError.INTERNAL_ERROR));
        assertThat(memory.get(USER_ID + ":" + CONVERSATION_ID)).isEmpty();
    }

    static Stream<Arguments> emptyAnswers() {
        return Stream.of(
                Arguments.of(Named.of("응답 없음", Flux.<ChatResponse>empty())),
                Arguments.of(Named.of("공백뿐인 응답", Flux.just(response(" \n "))))
        );
    }

    @Test
    @DisplayName("답변 뒤의 추천 데이터가 잘못되면 카드를 보내거나 대화를 저장하지 않는다")
    void invalidRecommendationOutputDoesNotCompleteOrRecordTheTurn() {
        // given
        when(model.stream(any(Prompt.class))).thenReturn(Flux.just(
                chunk("{\"answer\":\"부분 답변\",\"recommendedItemIds\":[\"1\"]}")));

        // when, then
        assertThatThrownBy(() -> service.chat(USER_ID, CONVERSATION_ID, "추천해줘", reply))
                .isInstanceOf(BusinessException.class);
        verify(reply).sendAnswerChunk("부분 답변");
        verify(reply, never()).sendComponent(any());
        verify(reply, never()).complete(any(), any());
        assertThat(memory.get(USER_ID + ":" + CONVERSATION_ID)).isEmpty();
    }

    @Test
    @DisplayName("연결이 종료되면 완성된 답변도 대화에 저장하지 않는다")
    void closedReplyDoesNotRecordTheCompletedAnswer() {
        // given
        when(model.stream(any(Prompt.class))).thenReturn(Flux.just(response("완성된 답변")));
        doThrow(new CancellationException("연결 종료"))
                .when(reply).complete(any(ChatResult.class), any(Runnable.class));

        // when, then
        assertThatThrownBy(() -> service.chat(USER_ID, CONVERSATION_ID, "질문", reply))
                .isInstanceOf(CancellationException.class);
        assertThat(memory.get(USER_ID + ":" + CONVERSATION_ID)).isEmpty();
    }

    @Test
    @DisplayName("답변 조각 전송이 실패하면 모델 구독을 취소하고 대화를 저장하지 않는다")
    void sendingAChunkFailureCancelsTheModelAndDiscardsTheTurn() {
        // given
        TestPublisher<ChatResponse> publisher = TestPublisher.create();
        doThrow(new CancellationException("SSE 연결 종료")).when(reply).sendAnswerChunk("일부 답변");
        Future<?> responseTask = startStreamingChat(publisher);

        publisher.assertSubscribers(1);

        // when
        publisher.next(chunk("{\"answer\":\"일부 답변"));

        // then
        assertThatThrownBy(() -> responseTask.get(5, TimeUnit.SECONDS))
                .hasCauseInstanceOf(CancellationException.class);
        publisher.assertCancelled();
        assertThat(memory.get(USER_ID + ":" + CONVERSATION_ID)).isEmpty();
    }

    @Test
    @DisplayName("응답 작업이 중단되면 모델 구독을 취소하고 늦게 도착한 답변을 저장하지 않는다")
    void interruptCancelsTheModelAndDiscardsLateResults() {
        // given
        TestPublisher<ChatResponse> publisher = TestPublisher.createNoncompliant(
                TestPublisher.Violation.DEFER_CANCELLATION);
        Future<?> responseTask = startStreamingChat(publisher);

        // when
        publisher.next(chunk("{\"answer\":\"중단할 답변"));
        await().untilAsserted(() -> verify(reply).sendAnswerChunk("중단할 답변"));
        responseTask.cancel(true);

        // then
        await().untilAsserted(publisher::assertCancelled);
        await().untilTrue(responseFinished);

        // when, then: 중단 이후에 도착한 답변은 저장하지 않는다
        publisher.next(response("늦은 답변")).complete();
        assertThat(memory.get(USER_ID + ":" + CONVERSATION_ID)).isEmpty();

        // given
        when(model.stream(any(Prompt.class))).thenReturn(Flux.just(response("재시도")));

        // when
        service.chat(USER_ID, CONVERSATION_ID, "재요청", reply);

        // then
        assertThat(memory.get(USER_ID + ":" + CONVERSATION_ID))
                .extracting(message -> message.getText())
                .containsExactly("재요청", "재시도");
    }

    @Test
    @DisplayName("같은 사용자의 같은 대화에 대한 동시 요청은 거절한다")
    void rejectsConcurrentRequestsForTheSameConversation() {
        // given
        TestPublisher<ChatResponse> publisher = TestPublisher.create();
        startStreamingChat(publisher);

        // when, then
        assertThatThrownBy(() -> service.chat(USER_ID, CONVERSATION_ID, "중복 요청", reply))
                .isInstanceOfSatisfying(BusinessException.class,
                        exception -> assertThat(exception.clientError()).isEqualTo(ClientError.INTERNAL_ERROR));
        assertThat(memory.get(USER_ID + ":" + CONVERSATION_ID)).isEmpty();
    }

    @Test
    @DisplayName("대화 ID가 같아도 다른 사용자의 요청은 동시에 처리한다")
    void allowsConcurrentRequestsForAnotherUser() {
        // given
        TestPublisher<ChatResponse> publisher = TestPublisher.create();
        startStreamingChat(publisher);
        when(model.stream(any(Prompt.class))).thenReturn(Flux.just(response("다른 사용자")));

        // when
        service.chat(ANOTHER_USER_ID, CONVERSATION_ID, "질문", reply);

        // then
        assertThat(memory.get(ANOTHER_USER_ID + ":" + CONVERSATION_ID))
                .extracting(message -> message.getText())
                .containsExactly("질문", "다른 사용자");
    }

    @Test
    @DisplayName("사용자가 같아도 다른 대화의 요청은 동시에 처리한다")
    void allowsConcurrentRequestsForAnotherConversation() {
        // given
        TestPublisher<ChatResponse> publisher = TestPublisher.create();
        startStreamingChat(publisher);
        when(model.stream(any(Prompt.class))).thenReturn(Flux.just(response("다른 대화 답변")));

        // when
        service.chat(USER_ID, ANOTHER_CONVERSATION_ID, "질문", reply);

        // then
        assertThat(memory.get(USER_ID + ":" + ANOTHER_CONVERSATION_ID))
                .extracting(message -> message.getText())
                .containsExactly("질문", "다른 대화 답변");
    }

    private Future<?> startStreamingChat(TestPublisher<ChatResponse> publisher) {
        CountDownLatch subscribed = new CountDownLatch(1);
        when(model.stream(any(Prompt.class))).thenReturn(publisher.flux()
                .doOnSubscribe(ignored -> subscribed.countDown()));
        Future<?> responseTask = executor.submit(() -> {
            try {
                service.chat(USER_ID, CONVERSATION_ID, "질문", reply);
            } finally {
                responseFinished.set(true);
            }
        });
        await().until(() -> subscribed.getCount() == 0);
        return responseTask;
    }

    private void givenConversationHistory() {
        memory.add(USER_ID + ":" + CONVERSATION_ID,
                List.of(new UserMessage("예산은 1000"), new AssistantMessage("알겠습니다.")));
    }

    private Prompt captureModelPrompt() {
        ArgumentCaptor<Prompt> prompt = ArgumentCaptor.forClass(Prompt.class);
        verify(model).stream(prompt.capture());
        return prompt.getValue();
    }

    private static ChatResponse response(String text) {
        return chunk(JsonMapper.builder().build().writeValueAsString(new ChatAnswer(text, List.of())));
    }

    private static ChatResponse chunk(String text) {
        return new ChatResponse(List.of(new Generation(new AssistantMessage(text))));
    }
}
