package com.bibbidi.wedding.sse.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.bibbidi.wedding.sse.service.dto.SseEvent;
import java.time.Duration;
import java.util.concurrent.CancellationException;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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

        verify(remember).run();
        verify(emitter).send(any(SseEmitter.SseEventBuilder.class));
        verify(emitter).complete();
        verify(timer).cancel(false);
        verify(task, never()).cancel(true);
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
