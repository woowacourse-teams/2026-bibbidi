package com.bibbidi.wedding.chat.infra.sse;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;

import com.bibbidi.wedding.chat.infra.sse.dto.ChatEventType;
import com.bibbidi.wedding.chat.infra.sse.dto.SseEvent;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Duration;
import java.util.concurrent.CancellationException;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
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
        connection = new SseConnection(emitter, new SseEvent(ChatEventType.FAILURE, "공개 실패 안내"),
                System.nanoTime() + Duration.ofSeconds(30).toNanos());
        task = mock(Future.class);
        timer = mock(Future.class);
        connection.attachTask(task);
        connection.attachTimeout(timer);
    }

    @Test
    @DisplayName("정상 완료 시 성공 처리를 실행하고 타이머만 취소한다")
    void completionRunsTheSuccessActionAndCancelsOnlyTheTimer() throws Exception {
        // given
        Runnable remember = mock(Runnable.class);

        // when
        connection.complete(new SseEvent(ChatEventType.DONE, "대화 ID"), remember);
        connection.timeout();
        connection.disconnect();

        // then
        InOrder completion = inOrder(emitter, remember);
        completion.verify(emitter).send(any(SseEmitter.SseEventBuilder.class));
        completion.verify(remember).run();
        completion.verify(emitter).complete();
        verify(timer).cancel(false);
        verify(task, never()).cancel(true);
    }

    @Test
    @DisplayName("성공 처리가 실패해도 추가 이벤트 없이 응답을 종료한다")
    void completionActionFailureEndsTheResponseWithoutSendingAnotherEvent() throws Exception {
        // given
        Runnable remember = mock(Runnable.class);
        doThrow(new IllegalStateException("대화 기억 저장 실패")).when(remember).run();

        // when
        connection.complete(new SseEvent(ChatEventType.DONE, "대화 ID"), remember);
        connection.fail(new IllegalStateException("완료 후 오류"));
        connection.timeout();
        connection.disconnect();

        // then
        verify(remember).run();
        verify(emitter).send(any(SseEmitter.SseEventBuilder.class));
        verify(emitter).complete();
        verifyNoMoreInteractions(emitter);
        verify(timer).cancel(false);
        verify(task, never()).cancel(true);
    }

    @Test
    @DisplayName("완료 이벤트 전송 중 입출력 오류가 발생하면 성공 처리를 실행하지 않는다")
    void finalEventWriteFailureDoesNotRunTheSuccessAction() throws Exception {
        // given
        IOException exception = new IOException("연결이 끊겼습니다.");
        doThrow(exception).when(emitter).send(any(SseEmitter.SseEventBuilder.class));
        Runnable remember = mock(Runnable.class);

        // when, then
        assertThatThrownBy(() -> connection.complete(new SseEvent(ChatEventType.DONE, "대화 ID"), remember))
                .isInstanceOf(UncheckedIOException.class)
                .hasCause(exception);

        verifyNoInteractions(remember);
        verify(task).cancel(true);
        verify(timer).cancel(false);
    }

    @Test
    @DisplayName("완료 이벤트 전송이 거절되면 성공 처리를 실행하지 않는다")
    void finalEventRejectionDoesNotRunTheSuccessAction() throws Exception {
        // given
        IllegalStateException exception = new IllegalStateException("SSE 응답이 이미 종료되었습니다.");
        doThrow(exception).when(emitter).send(any(SseEmitter.SseEventBuilder.class));
        Runnable remember = mock(Runnable.class);

        // when, then
        assertThatThrownBy(() -> connection.complete(new SseEvent(ChatEventType.DONE, "대화 ID"), remember))
                .isSameAs(exception);

        verifyNoInteractions(remember);
        verify(task).cancel(true);
        verify(timer).cancel(false);
    }

    @Test
    @DisplayName("시간이 초과되면 응답 작업을 취소하고 이후 완료 처리를 거절한다")
    void timeoutCancelsTheWorkerAndRejectsLateCompletion() throws Exception {
        // given
        Runnable remember = mock(Runnable.class);

        // when
        connection.timeout();
        connection.timeout();

        // then
        assertThatThrownBy(() -> connection.complete(new SseEvent(ChatEventType.DONE, "대화 ID"), remember))
                .isInstanceOf(CancellationException.class);

        verifyNoInteractions(remember);
        verify(task).cancel(true);
        verify(timer).cancel(false);
        verify(emitter).send(any(SseEmitter.SseEventBuilder.class));
        verify(emitter).complete();
    }

    @Test
    @DisplayName("연결이 끊기면 추가 이벤트 없이 응답 작업을 취소한다")
    void disconnectionCancelsTheWorkerWithoutSendingAnotherEvent() {
        // when
        connection.disconnect();

        // then
        assertThatThrownBy(() -> connection.send(new SseEvent(ChatEventType.DELTA, "늦은 답변")))
                .isInstanceOf(CancellationException.class);
        connection.fail(new IllegalStateException("늦은 오류"));

        verify(task).cancel(true);
        verify(timer).cancel(false);
        verifyNoInteractions(emitter);
    }

    @Test
    @DisplayName("타이머가 실행되지 않았어도 제한 시간이 지나면 완료 처리를 거절한다")
    void completionChecksTheDeadlineEvenWhenTheTimerHasNotRunYet() {
        // given
        SseConnection expired = new SseConnection(emitter, new SseEvent(ChatEventType.FAILURE, "공개 실패 안내"), System.nanoTime() - 1);
        Runnable remember = mock(Runnable.class);

        // when, then
        assertThatThrownBy(() -> expired.complete(new SseEvent(ChatEventType.DONE, "대화 ID"), remember))
                .isInstanceOf(CancellationException.class);
        verifyNoInteractions(remember, emitter);
    }
}
