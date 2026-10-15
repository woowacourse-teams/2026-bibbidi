package com.bibbidi.wedding.chat.controller.sse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.bibbidi.wedding.chat.controller.sse.dto.SseEvent;
import com.bibbidi.wedding.chat.support.RecordingSseEmitter;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Duration;
import java.util.concurrent.CancellationException;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class SseConnectionTest {

    private static final String SEND = RecordingSseEmitter.SEND;
    private static final String COMPLETE = RecordingSseEmitter.COMPLETE;
    private static final String REMEMBER = "remember";

    private RecordingSseEmitter emitter;
    private SseConnection connection;
    private Future<?> task;
    private Future<?> timer;

    @BeforeEach
    void setUp() {
        emitter = new RecordingSseEmitter();
        connection = new SseConnection(emitter, new SseEvent(ChatEventType.FAILURE, "공개 실패 안내"),
                System.nanoTime() + Duration.ofSeconds(30).toNanos());
        task = mock(Future.class);
        timer = mock(Future.class);
        connection.attachTask(task);
        connection.attachTimeout(timer);
    }

    @Test
    @DisplayName("정상 완료 시 마지막 이벤트를 보낸 뒤 성공 처리를 실행하고 응답을 닫으며, 타이머만 취소한다")
    void completionSendsTheLastEventRunsTheSuccessActionAndCancelsOnlyTheTimer() {
        // given
        Runnable remember = () -> emitter.log().add(REMEMBER);

        // when
        connection.complete(new SseEvent(ChatEventType.DONE, "대화 ID"), remember);
        connection.timeout();
        connection.disconnect();

        // then
        assertThat(emitter.log()).containsExactly(SEND, REMEMBER, COMPLETE);
        verify(timer).cancel(false);
        verify(task, never()).cancel(true);
    }

    @Test
    @DisplayName("성공 처리가 실패해도 추가 이벤트 없이 응답을 종료한다")
    void completionActionFailureEndsTheResponseWithoutSendingAnotherEvent() {
        // given
        Runnable failingRemember = () -> {
            emitter.log().add(REMEMBER);
            throw new IllegalStateException("대화 기억 저장 실패");
        };

        // when
        connection.complete(new SseEvent(ChatEventType.DONE, "대화 ID"), failingRemember);
        connection.fail(new IllegalStateException("완료 후 오류"));
        connection.timeout();
        connection.disconnect();

        // then
        assertThat(emitter.log()).containsExactly(SEND, REMEMBER, COMPLETE);
        verify(timer).cancel(false);
        verify(task, never()).cancel(true);
    }

    @Test
    @DisplayName("완료 이벤트 전송 중 입출력 오류가 발생하면 성공 처리를 실행하지 않고 작업을 취소한다")
    void finalEventWriteFailureDoesNotRunTheSuccessAction() {
        // given
        IOException exception = new IOException("연결이 끊겼습니다.");
        emitter.failSendWith(exception);
        Runnable remember = () -> emitter.log().add(REMEMBER);

        // when, then
        assertThatThrownBy(() -> connection.complete(new SseEvent(ChatEventType.DONE, "대화 ID"), remember))
                .isInstanceOf(UncheckedIOException.class)
                .hasCause(exception);
        assertThat(emitter.log()).doesNotContain(REMEMBER);
        verify(task).cancel(true);
        verify(timer).cancel(false);
    }

    @Test
    @DisplayName("완료 이벤트 전송이 거절되면 성공 처리를 실행하지 않고 작업을 취소한다")
    void finalEventRejectionDoesNotRunTheSuccessAction() {
        // given
        IllegalStateException exception = new IllegalStateException("SSE 응답이 이미 종료되었습니다.");
        emitter.failSendWith(exception);
        Runnable remember = () -> emitter.log().add(REMEMBER);

        // when, then
        assertThatThrownBy(() -> connection.complete(new SseEvent(ChatEventType.DONE, "대화 ID"), remember))
                .isSameAs(exception);
        assertThat(emitter.log()).doesNotContain(REMEMBER);
        verify(task).cancel(true);
        verify(timer).cancel(false);
    }

    @Test
    @DisplayName("시간이 초과되면 실패 이벤트를 한 번만 보내고 응답 작업을 취소하며, 이후 완료 처리를 거절한다")
    void timeoutCancelsTheWorkerAndRejectsLateCompletion() {
        // given
        Runnable remember = () -> emitter.log().add(REMEMBER);

        // when
        connection.timeout();
        connection.timeout();

        // then
        assertThatThrownBy(() -> connection.complete(new SseEvent(ChatEventType.DONE, "대화 ID"), remember))
                .isInstanceOf(CancellationException.class);
        assertThat(emitter.log()).containsExactly(SEND, COMPLETE);
        verify(task).cancel(true);
        verify(timer).cancel(false);
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
        assertThat(emitter.log()).isEmpty();
        verify(task).cancel(true);
        verify(timer).cancel(false);
    }

    @Test
    @DisplayName("타이머가 실행되지 않았어도 제한 시간이 지나면 완료 처리를 거절한다")
    void completionChecksTheDeadlineEvenWhenTheTimerHasNotRunYet() {
        // given
        SseConnection expired = new SseConnection(emitter, new SseEvent(ChatEventType.FAILURE, "공개 실패 안내"),
                System.nanoTime() - 1);
        Runnable remember = () -> emitter.log().add(REMEMBER);

        // when, then
        assertThatThrownBy(() -> expired.complete(new SseEvent(ChatEventType.DONE, "대화 ID"), remember))
                .isInstanceOf(CancellationException.class);
        assertThat(emitter.log()).isEmpty();
    }
}
