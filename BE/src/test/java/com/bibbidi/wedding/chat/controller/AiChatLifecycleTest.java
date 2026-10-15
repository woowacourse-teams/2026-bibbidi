package com.bibbidi.wedding.chat.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.chat.adapter.ai.SpringAiConversationAdapter;
import com.bibbidi.wedding.chat.service.parser.JacksonChatAnswerParser;
import com.bibbidi.wedding.chat.controller.sse.ChatSseHandler;
import com.bibbidi.wedding.chat.controller.sse.SseStreamManager;
import com.bibbidi.wedding.chat.adapter.ai.BibbidiInMemoryChatMemory;
import com.bibbidi.wedding.chat.controller.sse.dto.ChatEventType;
import com.bibbidi.wedding.chat.controller.sse.dto.SseEvent;
import com.bibbidi.wedding.chat.service.AiChatService;
import com.bibbidi.wedding.chat.service.dto.ChatAnswer;
import com.bibbidi.wedding.chat.service.dto.ChatEvent;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.model.tool.ToolCallingChatOptions;
import reactor.core.publisher.Flux;
import reactor.test.publisher.TestPublisher;
import tools.jackson.databind.json.JsonMapper;

class AiChatLifecycleTest {

    private static final UUID ID = UUID.fromString("7bf4d204-8331-439b-bd8f-271abc0eea99");
    private static final Duration RESPONSE_TIMEOUT = Duration.ofSeconds(30);
    private ChatModel model;
    private boolean answerStarted;
    private BibbidiInMemoryChatMemory memory;
    private AiChatService chat;
    private ScheduledExecutorService scheduler;
    private AtomicReference<Runnable> timeout;
    private ExecutorService executor;
    private AtomicBoolean responseFinished;

    @BeforeEach
    void setUp() {
        model = mock(ChatModel.class);
        when(model.getOptions()).thenReturn(ToolCallingChatOptions.builder().build());
        ChatMemoryRepository repository = new InMemoryChatMemoryRepository();
        memory = new BibbidiInMemoryChatMemory(repository, 18);
        ChecklistService checklistService = mock(ChecklistService.class);
        JsonMapper mapper = JsonMapper.builder().findAndAddModules().build();
        CatalogService catalogService = mock(CatalogService.class);
        chat = new AiChatService(new SpringAiConversationAdapter(ChatClient.create(model), memory, mapper),
                catalogService, checklistService,
                new JacksonChatAnswerParser(mapper));
        answerStarted = false;
        scheduler = mock(ScheduledExecutorService.class);
        timeout = new AtomicReference<>();
        executor = Executors.newVirtualThreadPerTaskExecutor();
        responseFinished = new AtomicBoolean();
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
        TestPublisher<ChatResponse> publisher = TestPublisher.create();
        ChatSseHandler handler = startStreamingChat(publisher);

        // when
        emitAnswerChunkAndAwaitDelivery(publisher, handler, "일부 ");
        emitAnswerChunkAndAwaitDelivery(publisher, handler, "답변");

        // then
        ArgumentCaptor<Long> delay = ArgumentCaptor.forClass(Long.class);
        verify(scheduler, times(1)).schedule(any(Runnable.class), delay.capture(), eq(TimeUnit.NANOSECONDS));
        assertThat(delay.getValue()).isPositive().isLessThanOrEqualTo(RESPONSE_TIMEOUT.toNanos());
    }

    @Test
    @DisplayName("시간이 초과되면 답변 생성을 중단하고 대화를 저장하지 않는다")
    void timeoutCancelsTheModelAndDiscardsTheTurn() {
        // given
        TestPublisher<ChatResponse> publisher = TestPublisher.create();
        ChatSseHandler handler = startStreamingChat(publisher);
        emitAnswerChunkAndAwaitDelivery(publisher, handler, "일부 답변");

        // when
        timeout.get().run();

        // then
        await().untilAsserted(publisher::assertCancelled);
        await().untilTrue(responseFinished);
        assertThat(memory.get("7:" + ID)).isEmpty();
    }

    @Test
    @DisplayName("모델이 작업 중단 요청을 무시해도 제한 시간 이후의 답변은 저장하지 않는다")
    void timeoutDuringModelSetupDiscardsAnAnswerEvenIfTheProviderIgnoresInterrupt() {
        // given
        CountDownLatch started = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        AtomicBoolean interrupted = new AtomicBoolean();
        when(model.stream(any(Prompt.class))).thenAnswer(invocation -> {
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
        sse.stream(RESPONSE_TIMEOUT, new SseEvent(ChatEventType.FAILURE, "실패 안내"), connection -> {
            try {
                sendEvents(connection, chat.chat(7L, ID, "질문"));
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
        assertThat(memory.get("7:" + ID)).isEmpty();
    }

    private ChatSseHandler startStreamingChat(TestPublisher<ChatResponse> publisher) {
        CountDownLatch subscribed = new CountDownLatch(1);
        AtomicReference<ChatSseHandler> handler = new AtomicReference<>();
        when(model.stream(any(Prompt.class))).thenReturn(publisher.flux()
                .doOnSubscribe(ignored -> subscribed.countDown()));

        SseStreamManager sse = new SseStreamManager(executor, scheduler);
        sse.stream(RESPONSE_TIMEOUT, new SseEvent(ChatEventType.FAILURE, "실패 안내"), connection -> {
            ChatSseHandler reply = spy(new ChatSseHandler(connection));
            handler.set(reply);
            try {
                chat.chat(7L, ID, "질문").doOnNext(reply::send).blockLast();
            } finally {
                responseFinished.set(true);
            }
        });
        await().until(() -> subscribed.getCount() == 0);
        return handler.get();
    }

    private void emitAnswerChunkAndAwaitDelivery(TestPublisher<ChatResponse> publisher, ChatSseHandler handler, String text) {
        CountDownLatch delivered = new CountDownLatch(1);
        doAnswer(invocation -> {
            invocation.callRealMethod();
            delivered.countDown();
            return null;
        }).when(handler).send(new ChatEvent.Delta(text));
        String jsonChunk = (answerStarted ? "" : "{\"answer\":\"") + text;
        answerStarted = true;
        publisher.next(new ChatResponse(List.of(new Generation(new AssistantMessage(jsonChunk)))));
        await().until(() -> delivered.getCount() == 0);
    }

    private static ChatResponse response(String text) {
        return new ChatResponse(List.of(new Generation(new AssistantMessage(
                JsonMapper.builder().build().writeValueAsString(new ChatAnswer(text, List.of()))))));
    }

    private static void sendEvents(com.bibbidi.wedding.chat.controller.sse.SseConnection connection,
                                   Flux<ChatEvent> events) {
        ChatSseHandler handler = new ChatSseHandler(connection);
        events.doOnNext(handler::send).blockLast();
    }
}
