package com.bibbidi.wedding.chat.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.chat.service.AiChatService;
import com.bibbidi.wedding.sse.service.SseService;
import com.bibbidi.wedding.sse.service.dto.SseEvent;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.model.tool.ToolCallingChatOptions;
import reactor.core.publisher.Flux;
import reactor.test.publisher.TestPublisher;

class AiChatLifecycleTest {

    private static final UUID ID = UUID.fromString("7bf4d204-8331-439b-bd8f-271abc0eea99");
    private ChatModel model;
    private ChatMemory memory;
    private AiChatService chat;
    private ScheduledExecutorService scheduler;
    private AtomicReference<Runnable> timeout;

    @BeforeEach
    void setUp() {
        model = mock(ChatModel.class);
        when(model.getOptions()).thenReturn(ToolCallingChatOptions.builder().build());
        memory = MessageWindowChatMemory.builder().maxMessages(20).build();
        chat = new AiChatService(ChatClient.create(model), memory);
        scheduler = mock(ScheduledExecutorService.class);
        timeout = new AtomicReference<>();
        when(scheduler.schedule(any(Runnable.class), anyLong(), eq(TimeUnit.NANOSECONDS)))
                .thenAnswer(invocation -> {
                    timeout.set(invocation.getArgument(0));
                    return mock(ScheduledFuture.class);
                });
    }

    @Test
    void chunksDoNotResetTheTotalTimerAndTimeoutCancelsTheModel() {
        var publisher = TestPublisher.<ChatResponse>create();
        var subscribed = new CountDownLatch(1);
        var sent = new CountDownLatch(2);
        var finished = new AtomicBoolean();
        when(model.stream(any(Prompt.class))).thenReturn(publisher.flux()
                .doOnSubscribe(ignored -> subscribed.countDown()));
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var sse = new SseService(executor, scheduler);
            sse.stream(Duration.ofSeconds(30), new SseEvent("failure", "실패 안내"), connection -> {
                try {
                    var handler = spy(new ChatSseHandler(connection));
                    doAnswer(invocation -> {
                        invocation.callRealMethod();
                        sent.countDown();
                        return null;
                    }).when(handler).sendAnswerChunk(anyString());
                    chat.chat(7L, ID, "질문", handler);
                } finally {
                    finished.set(true);
                }
            });
            await().until(() -> subscribed.getCount() == 0);
            publisher.next(response("일부 "));
            await().until(() -> sent.getCount() == 1);
            publisher.next(response("답변"));
            await().until(() -> sent.getCount() == 0);
            var delay = ArgumentCaptor.forClass(Long.class);
            verify(scheduler, times(1)).schedule(any(Runnable.class), delay.capture(), eq(TimeUnit.NANOSECONDS));
            assertThat(delay.getValue()).isPositive().isLessThanOrEqualTo(Duration.ofSeconds(30).toNanos());
            timeout.get().run();
            await().untilAsserted(publisher::assertCancelled);
            await().untilTrue(finished);
            assertThat(memory.get("7:" + ID)).isEmpty();
        }
    }

    @Test
    void timeoutDuringModelSetupDiscardsAnAnswerEvenIfTheProviderIgnoresInterrupt() {
        var started = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var interrupted = new AtomicBoolean();
        var finished = new AtomicBoolean();
        when(model.stream(any(Prompt.class))).thenAnswer(invocation -> {
            assertThat(Thread.currentThread().isVirtual()).isTrue();
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
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var sse = new SseService(executor, scheduler);
            sse.stream(Duration.ofSeconds(30), new SseEvent("failure", "실패 안내"), connection -> {
                try {
                    chat.chat(7L, ID, "질문", new ChatSseHandler(connection));
                } finally {
                    finished.set(true);
                }
            });
            try {
                await().until(() -> started.getCount() == 0);
                timeout.get().run();
                await().untilTrue(interrupted);
            } finally {
                release.countDown();
            }
            await().untilTrue(finished);
            assertThat(memory.get("7:" + ID)).isEmpty();
        }
    }

    private static ChatResponse response(String text) {
        return new ChatResponse(List.of(new Generation(new AssistantMessage(text))));
    }
}
