package com.bibbidi.wedding.chat.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;

import com.bibbidi.wedding.chat.service.dto.ChatAnswer;
import com.bibbidi.wedding.chat.service.dto.ChatCommand;
import com.bibbidi.wedding.chat.service.dto.ChatEvent;
import com.bibbidi.wedding.chat.adapter.ai.parser.JacksonChatAnswerParser;
import com.bibbidi.wedding.chat.adapter.ai.parser.ReactiveChatAnswerStream;
import com.bibbidi.wedding.chat.service.port.AiConversationPort;
import com.bibbidi.wedding.chat.service.port.AiResponse;
import com.bibbidi.wedding.chat.service.turn.CancelReason;
import com.bibbidi.wedding.chat.service.turn.TurnConsumer;
import com.bibbidi.wedding.chat.service.turn.TurnContext;
import com.bibbidi.wedding.chat.service.turn.TurnSignal;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.List;
import java.util.ArrayList;
import java.util.UUID;
import java.util.concurrent.CancellationException;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Supplier;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Named;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import reactor.core.Disposable;
import reactor.core.publisher.Flux;
import reactor.test.publisher.TestPublisher;
import tools.jackson.databind.json.JsonMapper;

class AiChatServiceTest {

    private static final JsonMapper MAPPER = JsonMapper.builder().findAndAddModules().build();
    private static final Long USER_ID = 7L;
    private static final Long ANOTHER_USER_ID = 8L;
    private static final UUID CONVERSATION_ID = UUID.fromString("7bf4d204-8331-439b-bd8f-271abc0eea99");
    private static final UUID ANOTHER_CONVERSATION_ID = UUID.fromString("7bf4d204-8331-439b-bd8f-271abc0eea98");

    private final List<ModelCall> modelCalls = new CopyOnWriteArrayList<>();
    private final List<List<TurnSignal>> recordedTurns = new CopyOnWriteArrayList<>();
    private final List<TurnContext> recordedContexts = new CopyOnWriteArrayList<>();
    private final AtomicBoolean transactionActiveAtModelCall = new AtomicBoolean(true);
    private volatile Supplier<Flux<String>> responder = Flux::empty;
    private AiChatService service;
    private List<ChatEvent> received;
    private ExecutorService executor;
    private AtomicBoolean responseFinished;

    @BeforeEach
    void setUp() {
        service = new AiChatService(
                new AiConversationPort() {
                    @Override
                    public String modelName() {
                        return "test-model";
                    }

                    @Override
                    public Flux<AiResponse> stream(Long userId, String conversationKey, String userPrompt) {
                        transactionActiveAtModelCall.set(TransactionSynchronizationManager.isActualTransactionActive());
                        modelCalls.add(new ModelCall(userId, conversationKey, userPrompt));
                        return parsedResponse(responder.get());
                    }
                },
                List.of((TurnConsumer) (context, signals) -> {
                    List<TurnSignal> turn = new CopyOnWriteArrayList<>();
                    recordedTurns.add(turn);
                    recordedContexts.add(context);
                    signals.subscribe(turn::add);
                }));
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
    @DisplayName("모델이 보낸 JSON 조각에서 답변만 조각별로 전달하고 완료하면 Done으로 끝낸다")
    void streamsDeltasAndEndsWithDone() throws Exception {
        // given
        TestPublisher<String> publisher = TestPublisher.create();
        Future<?> responseTask = startStreamingChat(publisher);

        // when
        publisher.next("{\"answer\":\"웨딩홀 ");
        await().until(() -> received.contains(new ChatEvent.Delta("웨딩홀 ")));
        publisher.next("계약을 확인하세요.\",\"recommendedItemIds\":[]}");
        await().until(() -> received.contains(new ChatEvent.Delta("계약을 확인하세요.")));
        publisher.complete();
        responseTask.get(5, TimeUnit.SECONDS);

        // then
        assertThat(received).containsExactly(
                new ChatEvent.Conversation(CONVERSATION_ID.toString()),
                new ChatEvent.Delta("웨딩홀 "),
                new ChatEvent.Delta("계약을 확인하세요."),
                new ChatEvent.Done(CONVERSATION_ID.toString()));
        assertThat(recordedTurns.getFirst()).filteredOn(TurnSignal.Chunk.class::isInstance)
                .extracting(signal -> ((TurnSignal.Chunk) signal).text())
                .containsExactly("{\"answer\":\"웨딩홀 ", "계약을 확인하세요.\",\"recommendedItemIds\":[]}");
    }

    @Test
    @DisplayName("대화 ID가 없으면 새 UUID를 생성해 전달한다")
    void generatesAnIdForANewConversation() {
        // given
        respondWith(Flux.just(answerJson("답변")));

        // when
        runChat(USER_ID, null, "질문");

        // then
        ChatEvent.Conversation conversation = (ChatEvent.Conversation) received.getFirst();
        UUID generatedId = UUID.fromString(conversation.conversationId());
        assertThat(received.getLast()).isEqualTo(new ChatEvent.Done(generatedId.toString()));
    }

    @Test
    @DisplayName("인증된 사용자의 ID와 질문을 모델 포트에 그대로 전달한다")
    void passesTheUserIdAndPromptToThePort() {
        // given
        respondWith(Flux.just(answerJson("답변")));

        // when
        runChat(USER_ID, CONVERSATION_ID, "질문");

        // then
        assertThat(modelCalls).containsExactly(new ModelCall(USER_ID, USER_ID + ":" + CONVERSATION_ID, "질문"));
    }

    @Test
    @DisplayName("모델이 낸 추천 ID를 추가 조회 없이 카드로 전달한 뒤 Done을 보낸다")
    void forwardsRecommendedItemIds() {
        // given
        respondWith(Flux.just(MAPPER.writeValueAsString(new ChatAnswer("답변", List.of(99L, 1L)))));

        // when
        runChat(USER_ID, CONVERSATION_ID, "추천해줘");

        // then
        assertThat(received).containsSubsequence(
                new ChatEvent.Component(List.of(99L, 1L)),
                new ChatEvent.Done(CONVERSATION_ID.toString()));
    }

    @Test
    @DisplayName("대화 기록 키는 사용자와 대화 ID로 구분한다")
    void separatesConversationKeysByUserAndConversation() {
        // given
        respondWith(Flux.just(answerJson("답변")));

        // when
        runChat(USER_ID, CONVERSATION_ID, "질문");
        runChat(ANOTHER_USER_ID, CONVERSATION_ID, "질문");
        runChat(USER_ID, ANOTHER_CONVERSATION_ID, "질문");

        // then
        assertThat(modelCalls).extracting(ModelCall::conversationKey).doesNotHaveDuplicates();
    }

    @Test
    @DisplayName("모델 호출 시 활성 트랜잭션이 없다")
    void callsTheModelWithoutAnActiveTransaction() throws Exception {
        // given
        respondWith(Flux.just(answerJson("답변")));

        // when
        Future<?> responseTask = executor.submit(() -> runChat(USER_ID, CONVERSATION_ID, "질문"));
        responseTask.get(5, TimeUnit.SECONDS);

        // then
        assertThat(modelCalls).hasSize(1);
        assertThat(transactionActiveAtModelCall.get()).isFalse();
    }

    @Test
    @DisplayName("모델 호출이 실패하면 오류를 전달하고 같은 대화로 재요청할 수 있다")
    void errorsAreDeliveredAndReleaseTheConversation() {
        // given
        TestPublisher<String> publisher = TestPublisher.create();
        Future<?> responseTask = startStreamingChat(publisher);

        // when
        publisher.next("{\"answer\":\"일부 답변");
        await().until(() -> received.contains(new ChatEvent.Delta("일부 답변")));
        publisher.error(new IllegalStateException("비공개 제공사 오류"));

        // then
        assertThatThrownBy(() -> responseTask.get(5, TimeUnit.SECONDS))
                .hasCauseInstanceOf(IllegalStateException.class);
        assertThat(received).noneMatch(event -> event instanceof ChatEvent.Done);

        // given
        respondWith(Flux.just(answerJson("새 답변")));

        // when
        runChat(USER_ID, CONVERSATION_ID, "다시 질문");

        // then
        assertThat(received.getLast()).isEqualTo(new ChatEvent.Done(CONVERSATION_ID.toString()));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("emptyAnswers")
    @DisplayName("답변이 비어 있거나 공백뿐이면 예외를 던진다")
    void emptyOrBlankAnswersFail(Flux<String> answer) {
        // given
        respondWith(answer);

        // when, then
        assertThatThrownBy(() -> runChat(USER_ID, CONVERSATION_ID, "질문"))
                .isInstanceOfSatisfying(BusinessException.class,
                        exception -> assertThat(exception.clientError()).isEqualTo(ClientError.INTERNAL_ERROR));
        assertThat(received).noneMatch(event -> event instanceof ChatEvent.Done);
    }

    static Stream<Arguments> emptyAnswers() {
        return Stream.of(
                Arguments.of(Named.of("응답 없음", Flux.<String>empty())),
                Arguments.of(Named.of("공백뿐인 응답", Flux.just(answerJson(" \n "))))
        );
    }

    @Test
    @DisplayName("추천 데이터가 잘못되면 받은 답변 조각까지만 전달하고 카드와 Done을 보내지 않는다")
    void invalidRecommendationOutputDoesNotSendCardsOrDone() {
        // given
        respondWith(Flux.just("{\"answer\":\"부분 답변\",\"recommendedItemIds\":[\"1\"]}"));

        // when, then
        assertThatThrownBy(() -> runChat(USER_ID, CONVERSATION_ID, "추천해줘"))
                .isInstanceOf(BusinessException.class);
        assertThat(received).contains(new ChatEvent.Delta("부분 답변"));
        assertThat(received).noneMatch(
                event -> event instanceof ChatEvent.Component || event instanceof ChatEvent.Done);
    }

    @Test
    @DisplayName("첫 이벤트만 받고 구독을 취소하면 모델을 구독하지 않는다")
    void cancelledSubscriptionBeforeTheModelDoesNotSubscribeToIt() {
        // given
        TestPublisher<String> publisher = TestPublisher.create();
        respondWith(publisher.flux());

        // when
        service.chat(new ChatCommand(USER_ID, CONVERSATION_ID, "질문"), () -> CancelReason.CLIENT_DISCONNECTED)
                .take(1)
                .blockLast();

        // then
        publisher.assertNoSubscribers();
    }

    @Test
    @DisplayName("완료 이벤트 전달이 실패하면 그 예외를 그대로 전달한다")
    void failedDoneDeliveryPropagatesTheException() {
        // given
        respondWith(Flux.just(answerJson("완성된 답변")));

        // when, then
        assertThatThrownBy(() -> service.chat(new ChatCommand(USER_ID, CONVERSATION_ID, "질문"),
                        () -> CancelReason.CLIENT_DISCONNECTED)
                .doOnNext(event -> {
                    if (event instanceof ChatEvent.Done) {
                        throw new CancellationException("연결 종료");
                    }
                }).blockLast()).isInstanceOf(CancellationException.class);
    }

    @Test
    @DisplayName("답변 조각 소비가 실패하면 모델 구독을 취소한다")
    void consumingAChunkFailureCancelsTheModel() {
        // given
        TestPublisher<String> publisher = TestPublisher.create();
        respondWith(publisher.flux());
        Future<?> responseTask = executor.submit(() -> service.chat(new ChatCommand(USER_ID, CONVERSATION_ID, "질문"),
                        () -> CancelReason.CLIENT_DISCONNECTED)
                .doOnNext(event -> {
                    if (event instanceof ChatEvent.Delta) {
                        throw new CancellationException("소비 중단");
                    }
                }).blockLast());

        await().untilAsserted(() -> publisher.assertSubscribers(1));

        // when
        publisher.next("{\"answer\":\"일부 답변");

        // then
        assertThatThrownBy(() -> responseTask.get(5, TimeUnit.SECONDS))
                .hasCauseInstanceOf(CancellationException.class);
        publisher.assertCancelled();
    }

    @Test
    @DisplayName("응답 작업을 중단하면 모델을 취소하고 늦게 도착한 답변은 전달하지 않는다")
    void interruptCancelsTheModelAndIgnoresLateResults() {
        // given
        TestPublisher<String> publisher = TestPublisher.createNoncompliant(
                TestPublisher.Violation.DEFER_CANCELLATION);
        Future<?> responseTask = startStreamingChat(publisher);
        publisher.next("{\"answer\":\"중단할 답변");
        await().until(() -> received.contains(new ChatEvent.Delta("중단할 답변")));

        // when
        responseTask.cancel(true);

        // then
        await().untilAsserted(publisher::assertCancelled);
        await().untilTrue(responseFinished);

        // when
        publisher.next(answerJson("늦은 답변")).complete();

        // then
        assertThat(received).noneMatch(event -> event instanceof ChatEvent.Done);

        // given
        respondWith(Flux.just(answerJson("재시도")));

        // when
        runChat(USER_ID, CONVERSATION_ID, "재요청");

        // then
        assertThat(received.getLast()).isEqualTo(new ChatEvent.Done(CONVERSATION_ID.toString()));
    }

    @Test
    @DisplayName("같은 대화에 새 요청이 오면 진행 중이던 응답을 중단하고 새 요청을 처리한다")
    void newRequestSupersedesTheInFlightResponseOfTheSameConversation() throws Exception {
        // given
        TestPublisher<String> publisher = TestPublisher.create();
        Future<?> firstResponse = startStreamingChat(publisher);
        respondWith(Flux.just(answerJson("새 답변")));

        // when
        runChat(USER_ID, CONVERSATION_ID, "새 질문");

        // then
        firstResponse.get(5, TimeUnit.SECONDS);
        publisher.assertCancelled();
        assertThat(received).contains(new ChatEvent.Done(CONVERSATION_ID.toString()));
        await().untilAsserted(() -> assertThat(recordedTurns.getFirst()).last()
                .isInstanceOfSatisfying(TurnSignal.Cancelled.class,
                        cancelled -> assertThat(cancelled.reason()).isEqualTo(CancelReason.SUPERSEDED)));
    }

    @Test
    @DisplayName("답변 조각을 받던 중 새 요청에 밀려도 이전 응답은 Done 없이 끝난다")
    void supersededResponseEndsWithoutDoneEvenWithAPartialAnswer() throws Exception {
        // given
        TestPublisher<String> publisher = TestPublisher.create();
        Future<?> firstResponse = startStreamingChat(publisher);
        publisher.next("{\"answer\":\"웨딩홀은 ");
        await().until(() -> received.contains(new ChatEvent.Delta("웨딩홀은 ")));
        respondWith(Flux.just(answerJson("새 답변")));

        // when
        runChat(USER_ID, CONVERSATION_ID, "새 질문");

        // then
        firstResponse.get(5, TimeUnit.SECONDS);
        assertThat(received.stream().filter(event -> event instanceof ChatEvent.Done)).hasSize(1);
        assertThat(modelCalls).extracting(ModelCall::prompt).containsExactly("질문", "새 질문");
    }

    @Test
    @DisplayName("중단된 이전 응답이 늦게 끝나도 새 요청의 진행 상태를 지우지 않는다")
    void supersededResponseDoesNotReleaseTheNewRequestsConversation() throws Exception {
        // given
        TestPublisher<String> firstPublisher = TestPublisher.create();
        startStreamingChat(firstPublisher);
        TestPublisher<String> secondPublisher = TestPublisher.create();
        CountDownLatch secondSubscribed = new CountDownLatch(1);
        respondWith(secondPublisher.flux()
                .doOnSubscribe(ignored -> secondSubscribed.countDown()));
        Future<?> secondResponse = executor.submit(() -> runChat(USER_ID, CONVERSATION_ID, "둘째 질문"));
        await().until(() -> secondSubscribed.getCount() == 0);
        respondWith(Flux.just(answerJson("셋째 답변")));

        // when
        runChat(USER_ID, CONVERSATION_ID, "셋째 질문");

        // then
        secondResponse.get(5, TimeUnit.SECONDS);
        secondPublisher.assertCancelled();
        assertThat(received.stream().filter(event -> event instanceof ChatEvent.Done)).hasSize(1);
    }

    @Test
    @DisplayName("대화 ID가 같아도 다른 사용자의 요청은 동시에 처리한다")
    void allowsConcurrentRequestsForAnotherUser() {
        // given
        TestPublisher<String> publisher = TestPublisher.create();
        startStreamingChat(publisher);
        respondWith(Flux.just(answerJson("다른 사용자")));

        // when
        runChat(ANOTHER_USER_ID, CONVERSATION_ID, "질문");

        // then
        publisher.assertWasNotCancelled();
        assertThat(received.getLast()).isEqualTo(new ChatEvent.Done(CONVERSATION_ID.toString()));
    }

    @Test
    @DisplayName("사용자가 같아도 다른 대화의 요청은 동시에 처리한다")
    void allowsConcurrentRequestsForAnotherConversation() {
        // given
        TestPublisher<String> publisher = TestPublisher.create();
        startStreamingChat(publisher);
        respondWith(Flux.just(answerJson("다른 대화 답변")));

        // when
        runChat(USER_ID, ANOTHER_CONVERSATION_ID, "질문");

        // then
        publisher.assertWasNotCancelled();
        assertThat(received.getLast()).isEqualTo(new ChatEvent.Done(ANOTHER_CONVERSATION_ID.toString()));
    }

    @Test
    @DisplayName("소비자가 연결을 끊으면 모델 호출을 취소하고 연결 종료 사유를 로깅 소비자에 전달한다")
    void clientDisconnectCancelsTheModelWithTheDisconnectReason() {
        // given
        TestPublisher<String> publisher = TestPublisher.create();
        respondWith(publisher.flux());
        Disposable subscription = service.chat(new ChatCommand(USER_ID, CONVERSATION_ID, "질문"),
                () -> CancelReason.CLIENT_DISCONNECTED).subscribe();
        await().untilAsserted(() -> publisher.assertSubscribers(1));
        publisher.next("{\"answer\":\"일부");

        // when
        subscription.dispose();

        // then
        await().untilAsserted(publisher::assertCancelled);
        await().untilAsserted(() -> assertCancelReason(CancelReason.CLIENT_DISCONNECTED));
    }

    @Test
    @DisplayName("전체 응답 시간 초과로 소비가 끊기면 지정한 사유를 로깅 소비자에 전달한다")
    void outputCancelUsesTheSuppliedReason() {
        // given
        TestPublisher<String> publisher = TestPublisher.create();
        respondWith(publisher.flux());
        Disposable subscription = service.chat(new ChatCommand(USER_ID, CONVERSATION_ID, "질문"),
                () -> CancelReason.RESPONSE_TIMEOUT).subscribe();
        await().untilAsserted(() -> publisher.assertSubscribers(1));

        // when
        subscription.dispose();

        // then
        await().untilAsserted(publisher::assertCancelled);
        await().untilAsserted(() -> assertCancelReason(CancelReason.RESPONSE_TIMEOUT));
    }

    @Test
    @DisplayName("모델 호출은 턴당 한 번만 하고 로깅 소비자도 한 턴만 받는다")
    void callsTheModelOncePerTurn() {
        // given
        respondWith(Flux.just(answerJson("답변")));

        // when
        runChat(USER_ID, CONVERSATION_ID, "질문");

        // then
        assertThat(modelCalls).hasSize(1);
        assertThat(recordedTurns).hasSize(1);
    }

    @Test
    @DisplayName("턴 소비자에게 사용자, 대화, 질문, 시작 시각을 전달한다")
    void passesTheTurnContextToConsumers() {
        // given
        respondWith(Flux.just(answerJson("답변")));

        // when
        runChat(USER_ID, CONVERSATION_ID, "질문");

        // then
        assertThat(recordedContexts).hasSize(1);
        TurnContext context = recordedContexts.getFirst();
        assertThat(context.userId()).isEqualTo(USER_ID);
        assertThat(context.conversationId()).isEqualTo(CONVERSATION_ID);
        assertThat(context.userPrompt()).isEqualTo("질문");
        assertThat(context.startedAt()).isNotNull();
    }

    private void assertCancelReason(CancelReason reason) {
        assertThat(recordedTurns).hasSize(1);
        assertThat(recordedTurns.getFirst()).last().isInstanceOfSatisfying(TurnSignal.Cancelled.class,
                cancelled -> assertThat(cancelled.reason()).isEqualTo(reason));
    }

    private Future<?> startStreamingChat(TestPublisher<String> publisher) {
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

    private void runChat(Long userId, UUID conversationId, String message) {
        service.chat(new ChatCommand(userId, conversationId, message), () -> CancelReason.CLIENT_DISCONNECTED)
                .doOnNext(received::add).blockLast();
    }

    private static String answerJson(String text) {
        return MAPPER.writeValueAsString(new ChatAnswer(text, List.of()));
    }

    private void respondWith(Flux<String> response) {
        responder = () -> response;
    }

    private static Flux<AiResponse> parsedResponse(Flux<String> rawResponse) {
        return Flux.defer(() -> {
            List<String> deltas = new ArrayList<>();
            ReactiveChatAnswerStream parser = new JacksonChatAnswerParser(MAPPER).newSession(deltas::add);
            Flux<AiResponse> chunks = rawResponse.map(raw -> {
                deltas.clear();
                parser.accept(raw);
                return new AiResponse.Chunk(raw, List.copyOf(deltas));
            });
            return chunks.concatWith(Flux.defer(() -> Flux.just(new AiResponse.Answer(parser.finish()))));
        });
    }

    private record ModelCall(Long userId, String conversationKey, String prompt) {
    }
}
