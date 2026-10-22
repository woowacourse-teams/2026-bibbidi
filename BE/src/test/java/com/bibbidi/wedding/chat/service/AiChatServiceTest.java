package com.bibbidi.wedding.chat.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.chat.adapter.ai.SpringAiConversationAdapter;
import com.bibbidi.wedding.chat.service.dto.command.ChatCommand;
import com.bibbidi.wedding.chat.service.dto.result.ChatAnswer;
import com.bibbidi.wedding.chat.service.dto.result.ChatEvent;
import com.bibbidi.wedding.chat.service.parser.JacksonChatAnswerParser;
import com.bibbidi.wedding.chat.service.port.CatalogLookupPort;
import com.bibbidi.wedding.chat.service.port.ChecklistLookupPort;
import com.bibbidi.wedding.chat.support.AiChatStreamRecorderFixture;
import com.bibbidi.wedding.chat.support.FakeChatModel;
import com.bibbidi.wedding.chat.support.SpringAiChatClientFixture;
import com.bibbidi.wedding.checklist.service.dto.ChecklistWithAppointmentsResult;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CancellationException;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Function;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Named;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.UserMessage;
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

    private final List<Prompt> receivedPrompts = new CopyOnWriteArrayList<>();
    private volatile Function<Prompt, Flux<ChatResponse>> responder = prompt -> Flux.empty();
    private ChatMemory memory;
    private AiChatService service;
    private List<ChatEvent> received;
    private CatalogLookupPort catalogService;
    private ChecklistLookupPort checklistService;
    private ExecutorService executor;
    private AtomicBoolean responseFinished;

    @BeforeEach
    void setUp() {
        FakeChatModel model = new FakeChatModel(prompt -> {
            receivedPrompts.add(prompt);
            return responder.apply(prompt);
        });
        ChatMemoryRepository repository = new InMemoryChatMemoryRepository();
        memory = MessageWindowChatMemory.builder().chatMemoryRepository(repository).maxMessages(18).build();
        catalogService = mock(CatalogLookupPort.class);
        checklistService = mock(ChecklistLookupPort.class);
        JsonMapper mapper = JsonMapper.builder().findAndAddModules().build();
        service = new AiChatService(new SpringAiConversationAdapter(SpringAiChatClientFixture.create(model, memory),
                AiChatStreamRecorderFixture.create()),
                catalogService, checklistService,
                new JacksonChatAnswerParser(mapper));
        executor = Executors.newVirtualThreadPerTaskExecutor();
        responseFinished = new AtomicBoolean();
        received = new CopyOnWriteArrayList<>();
    }

    @AfterEach
    void tearDown() {
        executor.shutdownNow();
        executor.close();
    }

    @Test
    @DisplayName("답변을 조각별로 전달하며 Advisor가 질문을 먼저, 모델 답변을 완료 후 저장한다")
    void streamsChunksAndRecordsOnlyTheCompletedTurn() throws Exception {
        // given
        TestPublisher<ChatResponse> publisher = TestPublisher.create();
        Future<?> responseTask = startStreamingChat(publisher);

        // when, then: 답변 조각을 받는 동안에는 대화를 저장하지 않는다
        publisher.next(chunk("{\"answer\":\"웨딩홀 "));
        await().until(() -> received.contains(new ChatEvent.Delta("웨딩홀 ")));
        assertThat(memory.get(new ConversationKey(USER_ID, CONVERSATION_ID).toMemoryKey())).extracting(message -> message.getText()).containsExactly("질문");
        publisher.next(chunk("계약을 확인하세요.\",\"recommendedItemIds\":[]}"));
        await().until(() -> received.contains(new ChatEvent.Delta("계약을 확인하세요.")));

        // when
        publisher.complete();
        responseTask.get(5, TimeUnit.SECONDS);

        // then
        assertThat(memory.get(new ConversationKey(USER_ID, CONVERSATION_ID).toMemoryKey()))
                .extracting(message -> message.getText())
                .containsExactly("질문", "{\"answer\":\"웨딩홀 계약을 확인하세요.\",\"recommendedItemIds\":[]}");
    }

    @Test
    @DisplayName("대화 ID가 없으면 새 UUID를 생성해 전달한다")
    void generatesAnIdForANewConversation() {
        // given
        respondWith(Flux.just(response("답변")));

        // when
        runChat(USER_ID, null, "질문");

        // then
        ChatEvent.Conversation conversation = (ChatEvent.Conversation) received.getFirst();
        UUID generatedId = UUID.fromString(conversation.conversationId());
        assertThat(conversation.conversationId()).isEqualTo(generatedId.toString());
    }

    @Test
    @DisplayName("모델을 호출하기 전에는 체크리스트와 카탈로그를 조회하지 않고 인증된 사용자의 ID를 도구 컨텍스트에 전달한다")
    void passesTheUserIdToToolsWithoutLoadingContextBeforeTheModel() {
        // given
        respondWith(Flux.just(response("답변")));

        // when
        runChat(USER_ID, CONVERSATION_ID, "질문");

        // then
        Prompt prompt = captureModelPrompt();
        ToolCallingChatOptions options = (ToolCallingChatOptions) prompt.getOptions();
        verifyNoInteractions(catalogService, checklistService);
        assertThat(options.getToolContext()).containsEntry("userId", USER_ID);
    }

    @Test
    @DisplayName("추천이 없는 답변은 체크리스트와 카탈로그를 조회하지 않고, 같은 대화의 다음 요청에는 앞선 대화를 전달한다")
    void reusesEarlierTurnsWithoutLoadingContextWhenNothingIsRecommended() {
        // given
        respondWith(Flux.just(response("답변")));

        // when
        runChat(USER_ID, CONVERSATION_ID, "첫 질문");
        runChat(USER_ID, CONVERSATION_ID, "둘째 질문");

        // then
        List<Prompt> prompts = receivedPrompts;
        assertThat(prompts).hasSize(2);
        assertThat(prompts.get(0).getInstructions()).extracting(message -> message.getText())
                .containsExactly("첫 질문");
        assertThat(prompts.get(1).getInstructions()).extracting(message -> message.getText())
                .containsExactly("첫 질문", jsonAnswer("답변"), "둘째 질문");
        verifyNoInteractions(catalogService, checklistService);
    }

    @Test
    @DisplayName("모델 호출 시 활성 트랜잭션이 없다")
    void callsTheModelWithoutAnActiveTransaction() throws Exception {
        // given
        AtomicBoolean transactionActive = new AtomicBoolean(true);
        respondWith(prompt -> {
            transactionActive.set(TransactionSynchronizationManager.isActualTransactionActive());
            return Flux.just(response("답변"));
        });

        // when
        Future<?> responseTask = executor.submit(() -> runChat(USER_ID, CONVERSATION_ID, "질문"));
        responseTask.get(5, TimeUnit.SECONDS);

        // then
        assertThat(transactionActive.get()).isFalse();
    }

    @Test
    @DisplayName("같은 사용자의 같은 대화에서는 이전 대화 기록을 사용한다")
    void reusesHistoryForTheSameUserAndConversation() {
        // given
        givenConversationHistory();
        respondWith(Flux.just(response("답변")));

        // when
        runChat(USER_ID, CONVERSATION_ID, "추천해줘");

        // then
        Prompt prompt = captureModelPrompt();
        assertThat(prompt.getInstructions())
                .extracting(message -> message.getText())
                .containsExactly("예산은 1000", "알겠습니다.", "추천해줘");
    }

    @Test
    @DisplayName("대화 ID가 같아도 다른 사용자의 대화 기록은 사용하지 않는다")
    void doesNotReuseAnotherUsersHistory() {
        // given
        givenConversationHistory();
        respondWith(Flux.just(response("답변")));

        // when
        runChat(ANOTHER_USER_ID, CONVERSATION_ID, "추천해줘");

        // then
        Prompt prompt = captureModelPrompt();
        assertThat(prompt.getInstructions())
                .extracting(message -> message.getText())
                .containsExactly("추천해줘");
    }

    @Test
    @DisplayName("사용자가 같아도 다른 대화의 기록은 사용하지 않는다")
    void doesNotReuseAnotherConversationsHistory() {
        // given
        givenConversationHistory();
        respondWith(Flux.just(response("답변")));

        // when
        runChat(USER_ID, ANOTHER_CONVERSATION_ID, "추천해줘");

        // then
        Prompt prompt = captureModelPrompt();
        assertThat(prompt.getInstructions())
                .extracting(message -> message.getText())
                .containsExactly("추천해줘");
    }

    @Test
    @DisplayName("중괄호가 포함된 사용자 메시지를 원문 그대로 전달한다")
    void userTextWithBracesIsPassedAsLiteralContent() {
        // given
        String question = "예산 {예산}과 조건 {\"촬영\":false}를 참고해줘";
        respondWith(Flux.just(response("확인했어요.")));

        // when
        runChat(USER_ID, null, question);

        // then
        Prompt prompt = captureModelPrompt();
        assertThat(prompt.getInstructions().getLast().getText()).isEqualTo(question);
        assertThat(received).contains(new ChatEvent.Delta("확인했어요."));
    }

    @Test
    @DisplayName("답변 생성이 실패하면 부분 답변을 저장하지 않고 같은 대화로 재요청할 수 있다")
    void errorsDoNotRecordPartialAnswersAndReleaseTheConversation() {
        // given
        TestPublisher<ChatResponse> publisher = TestPublisher.create();
        Future<?> responseTask = startStreamingChat(publisher);

        // when
        publisher.next(chunk("{\"answer\":\"일부 답변"));
        await().until(() -> received.contains(new ChatEvent.Delta("일부 답변")));
        publisher.error(new IllegalStateException("비공개 제공사 오류"));

        // then
        assertThatThrownBy(() -> responseTask.get(5, TimeUnit.SECONDS))
                .hasCauseInstanceOf(IllegalStateException.class);
        assertThat(memory.get(new ConversationKey(USER_ID, CONVERSATION_ID).toMemoryKey())).extracting(message -> message.getText()).containsExactly("질문");

        // given
        respondWith(Flux.just(response("새 답변")));

        // when
        runChat(USER_ID, CONVERSATION_ID, "다시 질문");

        // then
        assertThat(memory.get(new ConversationKey(USER_ID, CONVERSATION_ID).toMemoryKey()))
                .extracting(message -> message.getText())
                .containsExactly("질문", "다시 질문", jsonAnswer("새 답변"));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("emptyAnswers")
    @DisplayName("답변이 비어 있거나 공백뿐이면 예외를 던진다")
    void emptyOrBlankAnswersDoNotRecordATurn(Flux<ChatResponse> answer) {
        // given
        respondWith(answer);

        // when, then
        assertThatThrownBy(() -> runChat(USER_ID, CONVERSATION_ID, "질문"))
                .isInstanceOfSatisfying(BusinessException.class,
                        exception -> assertThat(exception.clientError()).isEqualTo(ClientError.INTERNAL_ERROR));
        assertThat(memory.get(new ConversationKey(USER_ID, CONVERSATION_ID).toMemoryKey())).isNotEmpty();
    }

    static Stream<Arguments> emptyAnswers() {
        return Stream.of(
                Arguments.of(Named.of("응답 없음", Flux.<ChatResponse>empty())),
                Arguments.of(Named.of("공백뿐인 응답", Flux.just(response(" \n "))))
        );
    }

    @Test
    @DisplayName("추천 데이터가 잘못되면 카드를 보내지 않는다")
    void invalidRecommendationOutputDoesNotCompleteOrRecordTheTurn() {
        // given
        respondWith(Flux.just(
                chunk("{\"answer\":\"부분 답변\",\"recommendedItemIds\":[\"1\"]}")));

        // when, then
        assertThatThrownBy(() -> runChat(USER_ID, CONVERSATION_ID, "추천해줘"))
                .isInstanceOf(BusinessException.class);
        assertThat(received).contains(new ChatEvent.Delta("부분 답변"));
        assertThat(received).noneMatch(event -> event instanceof ChatEvent.Component || event instanceof ChatEvent.Done);
        assertThat(memory.get(new ConversationKey(USER_ID, CONVERSATION_ID).toMemoryKey())).hasSize(2);
    }

    @Test
    @DisplayName("구독을 취소하면 완성되지 않은 답변을 저장하지 않는다")
    void cancelledSubscriptionDoesNotRecordTheAnswer() {
        // given
        TestPublisher<ChatResponse> publisher = TestPublisher.create();
        respondWith(publisher.flux());

        // when
        service.chat(new ChatCommand(USER_ID, CONVERSATION_ID, "질문"))
                .take(1)
                .blockLast();

        // then
        publisher.assertNoSubscribers();
        assertThat(memory.get(new ConversationKey(USER_ID, CONVERSATION_ID).toMemoryKey())).isEmpty();
    }

    @Test
    @DisplayName("완료 이벤트 전달이 실패해도 Advisor에는 모델 답변이 저장된다")
    void failedDoneDeliveryDoesNotRecordTheAnswer() {
        // given
        respondWith(Flux.just(response("완성된 답변")));

        // when, then
        assertThatThrownBy(() -> service.chat(new ChatCommand(USER_ID, CONVERSATION_ID, "질문"))
                .doOnNext(event -> {
                    if (event instanceof ChatEvent.Done) {
                        throw new CancellationException("연결 종료");
                    }
                }).blockLast()).isInstanceOf(CancellationException.class);
        assertThat(memory.get(new ConversationKey(USER_ID, CONVERSATION_ID).toMemoryKey())).hasSize(2);
    }

    @Test
    @DisplayName("답변 조각 소비가 실패하면 모델 구독을 취소하고 질문만 남긴다")
    void consumingAChunkFailureCancelsTheModelAndDiscardsTheTurn() {
        // given
        TestPublisher<ChatResponse> publisher = TestPublisher.create();
        respondWith(publisher.flux());
        Future<?> responseTask = executor.submit(() -> service.chat(new ChatCommand(USER_ID, CONVERSATION_ID, "질문"))
                .doOnNext(event -> {
                    if (event instanceof ChatEvent.Delta) {
                        throw new CancellationException("소비 중단");
                    }
                }).blockLast());

        await().untilAsserted(() -> publisher.assertSubscribers(1));

        // when
        publisher.next(chunk("{\"answer\":\"일부 답변"));

        // then
        assertThatThrownBy(() -> responseTask.get(5, TimeUnit.SECONDS))
                .hasCauseInstanceOf(CancellationException.class);
        publisher.assertCancelled();
        assertThat(memory.get(new ConversationKey(USER_ID, CONVERSATION_ID).toMemoryKey())).extracting(message -> message.getText()).containsExactly("질문");
    }

    @Test
    @DisplayName("응답 작업 중단 후 늦게 도착한 답변은 저장하지 않는다")
    void interruptCancelsTheModelAndDiscardsLateResults() {
        // given
        TestPublisher<ChatResponse> publisher = TestPublisher.createNoncompliant(
                TestPublisher.Violation.DEFER_CANCELLATION);
        Future<?> responseTask = startStreamingChat(publisher);

        // when
        publisher.next(chunk("{\"answer\":\"중단할 답변"));
        await().until(() -> received.contains(new ChatEvent.Delta("중단할 답변")));
        responseTask.cancel(true);

        // then
        await().untilAsserted(publisher::assertCancelled);
        await().untilTrue(responseFinished);

        // when, then: 중단 이후에 도착한 답변은 저장하지 않는다
        publisher.next(response("늦은 답변")).complete();
        assertThat(memory.get(new ConversationKey(USER_ID, CONVERSATION_ID).toMemoryKey())).extracting(message -> message.getText()).containsExactly("질문");

        // given
        respondWith(Flux.just(response("재시도")));

        // when
        runChat(USER_ID, CONVERSATION_ID, "재요청");

        // then
        assertThat(memory.get(new ConversationKey(USER_ID, CONVERSATION_ID).toMemoryKey()))
                .extracting(message -> message.getText())
                .containsExactly("질문", "재요청", jsonAnswer("재시도"));
    }

    @Test
    @DisplayName("같은 대화에 새 요청이 오면 진행 중이던 응답을 중단하고 새 요청을 처리한다")
    void newRequestSupersedesTheInFlightResponseOfTheSameConversation() throws Exception {
        // given
        TestPublisher<ChatResponse> publisher = TestPublisher.create();
        Future<?> firstResponse = startStreamingChat(publisher);
        respondWith(Flux.just(response("새 답변")));

        // when
        runChat(USER_ID, CONVERSATION_ID, "새 질문");

        // then
        firstResponse.get(5, TimeUnit.SECONDS);
        publisher.assertCancelled();
        assertThat(received).contains(new ChatEvent.Done(CONVERSATION_ID.toString()));
    }

    @Test
    @DisplayName("중단된 이전 응답의 질문만 기억에 남는다")
    void supersededTurnIsNotRecordedEvenWithAPartialAnswer() throws Exception {
        // given
        TestPublisher<ChatResponse> publisher = TestPublisher.create();
        Future<?> firstResponse = startStreamingChat(publisher);
        publisher.next(chunk("{\"answer\":\"웨딩홀은 "));
        await().until(() -> received.contains(new ChatEvent.Delta("웨딩홀은 ")));
        respondWith(Flux.just(response("새 답변")));

        // when
        runChat(USER_ID, CONVERSATION_ID, "새 질문");

        // then
        firstResponse.get(5, TimeUnit.SECONDS);
        assertThat(memory.get(new ConversationKey(USER_ID, CONVERSATION_ID).toMemoryKey()))
                .extracting(message -> message.getText())
                .containsExactly("질문", "새 질문", jsonAnswer("새 답변"));
        List<Prompt> prompts = receivedPrompts;
        assertThat(prompts).hasSize(2);
        assertThat(prompts.getLast().getInstructions())
                .extracting(message -> message.getText())
                .doesNotContain("웨딩홀은 ");
    }

    @Test
    @DisplayName("답변 조각 전 중단된 요청의 질문은 기억에 남는다")
    void supersededTurnWithoutAnswerChunksIsNotRecorded() throws Exception {
        // given
        TestPublisher<ChatResponse> publisher = TestPublisher.create();
        Future<?> firstResponse = startStreamingChat(publisher);
        respondWith(Flux.just(response("새 답변")));

        // when
        runChat(USER_ID, CONVERSATION_ID, "새 질문");

        // then
        firstResponse.get(5, TimeUnit.SECONDS);
        assertThat(memory.get(new ConversationKey(USER_ID, CONVERSATION_ID).toMemoryKey()))
                .extracting(message -> message.getText())
                .containsExactly("질문", "새 질문", jsonAnswer("새 답변"));
    }

    @Test
    @DisplayName("중단된 이전 응답이 늦게 끝나도 새 요청의 진행 상태를 지우지 않는다")
    void supersededResponseDoesNotReleaseTheNewRequestsConversation() throws Exception {
        // given
        TestPublisher<ChatResponse> firstPublisher = TestPublisher.create();
        startStreamingChat(firstPublisher);
        TestPublisher<ChatResponse> secondPublisher = TestPublisher.create();
        CountDownLatch secondSubscribed = new CountDownLatch(1);
        respondWith(secondPublisher.flux()
                .doOnSubscribe(ignored -> secondSubscribed.countDown()));
        Future<?> secondResponse = executor.submit(() -> runChat(USER_ID, CONVERSATION_ID, "둘째 질문"));
        await().until(() -> secondSubscribed.getCount() == 0);
        respondWith(Flux.just(response("셋째 답변")));

        // when
        runChat(USER_ID, CONVERSATION_ID, "셋째 질문");

        // then
        secondResponse.get(5, TimeUnit.SECONDS);
        secondPublisher.assertCancelled();
        assertThat(memory.get(new ConversationKey(USER_ID, CONVERSATION_ID).toMemoryKey()))
                .extracting(message -> message.getText())
                .containsExactly("질문", "둘째 질문", "셋째 질문", jsonAnswer("셋째 답변"));
    }

    @Test
    @DisplayName("대화 ID가 같아도 다른 사용자의 요청은 동시에 처리한다")
    void allowsConcurrentRequestsForAnotherUser() {
        // given
        TestPublisher<ChatResponse> publisher = TestPublisher.create();
        startStreamingChat(publisher);
        respondWith(Flux.just(response("다른 사용자")));

        // when
        runChat(ANOTHER_USER_ID, CONVERSATION_ID, "질문");

        // then
        assertThat(memory.get(new ConversationKey(ANOTHER_USER_ID, CONVERSATION_ID).toMemoryKey()))
                .extracting(message -> message.getText())
                .containsExactly("질문", jsonAnswer("다른 사용자"));
    }

    @Test
    @DisplayName("사용자가 같아도 다른 대화의 요청은 동시에 처리한다")
    void allowsConcurrentRequestsForAnotherConversation() {
        // given
        TestPublisher<ChatResponse> publisher = TestPublisher.create();
        startStreamingChat(publisher);
        respondWith(Flux.just(response("다른 대화 답변")));

        // when
        runChat(USER_ID, ANOTHER_CONVERSATION_ID, "질문");

        // then
        assertThat(memory.get(new ConversationKey(USER_ID, ANOTHER_CONVERSATION_ID).toMemoryKey()))
                .extracting(message -> message.getText())
                .containsExactly("질문", jsonAnswer("다른 대화 답변"));
    }

    private Future<?> startStreamingChat(TestPublisher<ChatResponse> publisher) {
        CountDownLatch subscribed = new CountDownLatch(1);
        respondWith(publisher.flux()
                .doOnSubscribe(ignored -> subscribed.countDown()));
        Future<?> responseTask = executor.submit(() -> {
            try {
                runChat(USER_ID, CONVERSATION_ID, "질문");
            } finally {
                responseFinished.set(true);
            }
        });
        await().until(() -> subscribed.getCount() == 0);
        return responseTask;
    }

    private void givenConversationHistory() {
        memory.add(new ConversationKey(USER_ID, CONVERSATION_ID).toMemoryKey(),
                List.of(new UserMessage("예산은 1000"), new AssistantMessage("알겠습니다.")));
    }

    private void runChat(Long userId, UUID conversationId, String message) {
        service.chat(new ChatCommand(userId, conversationId, message)).doOnNext(received::add).blockLast();
    }

    private Prompt captureModelPrompt() {
        assertThat(receivedPrompts).hasSize(1);
        return receivedPrompts.getLast();
    }

    private static ChatResponse response(String text) {
        return chunk(jsonAnswer(text));
    }

    private static String jsonAnswer(String text) {
        return JsonMapper.builder().build().writeValueAsString(new ChatAnswer(text, List.of()));
    }

    private static ChatResponse chunk(String text) {
        return new ChatResponse(List.of(new Generation(new AssistantMessage(text))));
    }

    private void respondWith(Flux<ChatResponse> response) {
        responder = prompt -> response;
    }

    private void respondWith(Function<Prompt, Flux<ChatResponse>> responder) {
        this.responder = responder;
    }
}
