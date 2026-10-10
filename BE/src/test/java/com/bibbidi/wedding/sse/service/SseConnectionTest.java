package com.bibbidi.wedding.sse.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;

import com.bibbidi.wedding.sse.service.dto.SseEvent;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Duration;
import java.util.concurrent.CancellationException;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

class SseConnectionTest {

    private SseEmitter emitter;
    private SseConnection connection;
    private Future<?> task;
    private Future<?> timer;

    @BeforeEach
    void setUp() {
        emitter = mock(SseEmitter.class);
        connection = new SseConnection(emitter, new SseEvent("failure", "공개 실패 안내"),
                System.nanoTime() + Duration.ofSeconds(30).toNanos());
        task = mock(Future.class);
        timer = mock(Future.class);
        connection.attachTask(task);
        connection.attachTimeout(timer);
    }

    @Test
    void completionRunsTheSuccessActionAndCancelsOnlyTheTimer() throws Exception {
        Runnable remember = mock(Runnable.class);
        connection.complete(new SseEvent("done", "대화 ID"), remember);
        connection.timeout();
        connection.disconnect();

        InOrder completion = inOrder(emitter, remember);
        completion.verify(emitter).send(any(SseEmitter.SseEventBuilder.class));
        completion.verify(remember).run();
        completion.verify(emitter).complete();
        verify(timer).cancel(false);
        verify(task, never()).cancel(true);
    }

    @Test
    void completionActionFailureEndsTheResponseWithoutSendingAnotherEvent() throws Exception {
        Runnable remember = mock(Runnable.class);
        doThrow(new IllegalStateException("대화 기억 저장 실패")).when(remember).run();

        connection.complete(new SseEvent("done", "대화 ID"), remember);
        connection.fail(new IllegalStateException("완료 후 오류"));
        connection.timeout();
        connection.disconnect();

        verify(remember).run();
        verify(emitter).send(any(SseEmitter.SseEventBuilder.class));
        verify(emitter).complete();
        verifyNoMoreInteractions(emitter);
        verify(timer).cancel(false);
        verify(task, never()).cancel(true);
    }

    @Test
    void finalEventWriteFailureDoesNotRunTheSuccessAction() throws Exception {
        IOException exception = new IOException("연결이 끊겼습니다.");
        doThrow(exception).when(emitter).send(any(SseEmitter.SseEventBuilder.class));
        Runnable remember = mock(Runnable.class);

        assertThatThrownBy(() -> connection.complete(new SseEvent("done", "대화 ID"), remember))
                .isInstanceOf(UncheckedIOException.class)
                .hasCause(exception);

        verifyNoInteractions(remember);
        verify(task).cancel(true);
        verify(timer).cancel(false);
    }

    @Test
    void finalEventRejectionDoesNotRunTheSuccessAction() throws Exception {
        IllegalStateException exception = new IllegalStateException("SSE 응답이 이미 종료되었습니다.");
        doThrow(exception).when(emitter).send(any(SseEmitter.SseEventBuilder.class));
        Runnable remember = mock(Runnable.class);

        assertThatThrownBy(() -> connection.complete(new SseEvent("done", "대화 ID"), remember))
                .isSameAs(exception);

        verifyNoInteractions(remember);
        verify(task).cancel(true);
        verify(timer).cancel(false);
    }

    @Test
    void timeoutCancelsTheWorkerAndRejectsLateCompletion() throws Exception {
        Runnable remember = mock(Runnable.class);
        connection.timeout();
        connection.timeout();
        assertThatThrownBy(() -> connection.complete(new SseEvent("done", "대화 ID"), remember))
                .isInstanceOf(CancellationException.class);

        verifyNoInteractions(remember);
        verify(task).cancel(true);
        verify(timer).cancel(false);
        verify(emitter).send(any(SseEmitter.SseEventBuilder.class));
        verify(emitter).complete();
    }

    @Test
    void disconnectionCancelsTheWorkerWithoutSendingAnotherEvent() {
        connection.disconnect();
        assertThatThrownBy(() -> connection.send(new SseEvent("delta", "늦은 답변")))
                .isInstanceOf(CancellationException.class);
        connection.fail(new IllegalStateException("늦은 오류"));

        verify(task).cancel(true);
        verify(timer).cancel(false);
        verifyNoInteractions(emitter);
    }

    @Test
    void completionChecksTheDeadlineEvenWhenTheTimerHasNotRunYet() {
        var expired = new SseConnection(emitter, new SseEvent("failure", "공개 실패 안내"), System.nanoTime() - 1);
        Runnable remember = mock(Runnable.class);
        assertThatThrownBy(() -> expired.complete(new SseEvent("done", "대화 ID"), remember))
                .isInstanceOf(CancellationException.class);
        verifyNoInteractions(remember, emitter);
    }
}
