package com.bibbidi.wedding.chat.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.chat.adapter.ai.SpringAiConversationAdapter;
import com.bibbidi.wedding.chat.controller.sse.ChatSseHandler;
import com.bibbidi.wedding.chat.controller.sse.SseStreamManager;
import com.bibbidi.wedding.chat.service.AiChatService;
import com.bibbidi.wedding.chat.adapter.ai.routing.ChatModelTier;
import com.bibbidi.wedding.chat.adapter.ai.routing.ModelClassifier;
import com.bibbidi.wedding.chat.service.subscriber.ClientSubscriber;
import com.bibbidi.wedding.chat.service.ConversationKey;
import com.bibbidi.wedding.chat.service.dto.result.ChatResult;
import com.bibbidi.wedding.chat.service.dto.command.ChatCommand;
import com.bibbidi.wedding.chat.adapter.ai.parser.JacksonChatAnswerParser;
import com.bibbidi.wedding.chat.service.turn.CancelReason;
import com.bibbidi.wedding.chat.support.FakeChatModel;
import com.bibbidi.wedding.chat.support.SpringAiChatClientFixture;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Function;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.test.publisher.TestPublisher;
import tools.jackson.databind.json.JsonMapper;

class AiChatLifecycleTest {

    private static final UUID ID = UUID.fromString("7bf4d204-8331-439b-bd8f-271abc0eea99");
    private static final Duration RESPONSE_TIMEOUT = Duration.ofSeconds(30);
    private final List<Prompt> receivedPrompts = new CopyOnWriteArrayList<>();
    private volatile Function<Prompt, Flux<ChatResponse>> responder = prompt -> Flux.empty();
    private boolean answerStarted;
    private ChatMemory memory;
    private AiChatService chat;
    private ScheduledExecutorService scheduler;
    private AtomicReference<Runnable> timeout;
    private ExecutorService executor;
    private AtomicBoolean responseFinished;
    private List<ChatResult> deliveredEvents;

    @BeforeEach
    void setUp() {
        FakeChatModel model = new FakeChatModel(prompt -> {
            receivedPrompts.add(prompt);
            return responder.apply(prompt);
        });
        ChatMemoryRepository repository = new InMemoryChatMemoryRepository();
        memory = MessageWindowChatMemory.builder().chatMemoryRepository(repository).maxMessages(18).build();
        JsonMapper mapper = JsonMapper.builder().findAndAddModules().build();
        ModelClassifier classifier = mock(ModelClassifier.class);
        when(classifier.classify(anyString(), anyString())).thenReturn(Mono.just(ChatModelTier.LOW));
        chat = new AiChatService(
                new SpringAiConversationAdapter(SpringAiChatClientFixture.create(model, memory),
                        new JacksonChatAnswerParser(mapper), memory, classifier),
                List.of(new ClientSubscriber()));
        answerStarted = false;
        scheduler = mock(ScheduledExecutorService.class);
        timeout = new AtomicReference<>();
        executor = Executors.newVirtualThreadPerTaskExecutor();
        responseFinished = new AtomicBoolean();
        deliveredEvents = new CopyOnWriteArrayList<>();
        when(scheduler.schedule(any(Runnable.class), anyLong(), eq(TimeUnit.NANOSECONDS)))
                .thenAnswer(invocation -> {
                    timeout.set(invocation.getArgument(0));
                    return mock(ScheduledFuture.class);
                });
    }

    @AfterEach
    void tearDown() {
        executor.shutdownNow();
        executor.close();
    }

    @Test
    @DisplayName("답변 조각이 도착해도 제한 시간을 연장하지 않는다")
    void chunksDoNotResetTheTotalTimer() {
        // given
        TestPublisher<ChatResponse> publisher = TestPublisher.createCold();
        startStreamingChat(publisher);

        // when
        emitAnswerChunkAndAwaitDelivery(publisher, "일부 ");
        emitAnswerChunkAndAwaitDelivery(publisher, "답변");

        // then
        ArgumentCaptor<Long> delay = ArgumentCaptor.forClass(Long.class);
        verify(scheduler, times(1)).schedule(any(Runnable.class), delay.capture(), eq(TimeUnit.NANOSECONDS));
        assertThat(delay.getValue()).isPositive().isLessThanOrEqualTo(RESPONSE_TIMEOUT.toNanos());
    }

    @Test
    @DisplayName("시간이 초과되면 답변 생성을 중단하고 질문만 기억에 남긴다")
    void timeoutCancelsTheModelAndDiscardsTheTurn() {
        // given
        TestPublisher<ChatResponse> publisher = TestPublisher.create();
        startStreamingChat(publisher);
        emitAnswerChunkAndAwaitDelivery(publisher, "일부 답변");

        // when
        timeout.get().run();

        // then
        await().untilAsserted(publisher::assertCancelled);
        await().untilTrue(responseFinished);
        assertThat(memory.get(new ConversationKey(7L, ID).toMemoryKey())).extracting(message -> message.getText())
                .containsExactly("질문");
    }

    @Test
    @DisplayName("모델이 작업 중단 요청을 무시해도 제한 시간 이후의 답변은 저장하지 않는다")
    void timeoutDuringModelSetupDiscardsAnAnswerEvenIfTheProviderIgnoresInterrupt() {
        // given
        CountDownLatch started = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        AtomicBoolean interrupted = new AtomicBoolean();
        respondWith(prompt -> {
            started.countDown();
            while (release.getCount() != 0) {
                try {
                    release.await();
                } catch (InterruptedException ignored) {
                    interrupted.set(true);
                }
            }
            return Flux.just(response("늦은 답변"));
        });
        SseStreamManager sse = new SseStreamManager(executor, scheduler);
        sse.stream(RESPONSE_TIMEOUT, connection -> {
            try {
                sendEvents(connection,
                        chat.chat(new ChatCommand(7L, ID, "질문"), () -> CancelReason.CLIENT_DISCONNECTED));
            } finally {
                responseFinished.set(true);
            }
        });
        try {
            await().until(() -> started.getCount() == 0);

            // when
            timeout.get().run();

            // then
            await().untilTrue(interrupted);
        } finally {
            release.countDown();
        }

        // then
        await().untilTrue(responseFinished);
        assertThat(memory.get(new ConversationKey(7L, ID).toMemoryKey())).extracting(message -> message.getText())
                .containsExactly("질문");
    }

    private void startStreamingChat(TestPublisher<ChatResponse> publisher) {
        CountDownLatch subscribed = new CountDownLatch(1);
        respondWith(publisher.flux()
                .doOnSubscribe(ignored -> subscribed.countDown()));

        SseStreamManager sse = new SseStreamManager(executor, scheduler);
        sse.stream(RESPONSE_TIMEOUT, connection -> {
            ChatSseHandler reply = new ChatSseHandler(connection);
            try {
                chat.chat(new ChatCommand(7L, ID, "질문"), () -> CancelReason.CLIENT_DISCONNECTED).doOnNext(event -> {
                    reply.send(event);
                    deliveredEvents.add(event);
                }).blockLast();
            } finally {
                responseFinished.set(true);
            }
        });
        await().until(() -> subscribed.getCount() == 0);
    }

    private void emitAnswerChunkAndAwaitDelivery(TestPublisher<ChatResponse> publisher, String text) {
        String jsonChunk = (answerStarted ? "" : "{\"answer\":\"") + text;
        answerStarted = true;
        publisher.next(new ChatResponse(List.of(new Generation(new AssistantMessage(jsonChunk)))));
        await().until(() -> deliveredEvents.stream()
                .anyMatch(event -> event instanceof ChatResult.Delta delta && delta.text().equals(text)));
    }

    private static ChatResponse response(String text) {
        return new ChatResponse(List.of(new Generation(new AssistantMessage(
                JsonMapper.builder().build().writeValueAsString(new ChatResult.Answer(text, List.of()))))));
    }

    private static void sendEvents(com.bibbidi.wedding.chat.controller.sse.SseConnection connection,
                                   Flux<ChatResult> events) {
        ChatSseHandler handler = new ChatSseHandler(connection);
        events.doOnNext(handler::send).blockLast();
    }

    private void respondWith(Flux<ChatResponse> response) {
        responder = prompt -> response;
    }

    private void respondWith(Function<Prompt, Flux<ChatResponse>> responder) {
        this.responder = responder;
    }
}
