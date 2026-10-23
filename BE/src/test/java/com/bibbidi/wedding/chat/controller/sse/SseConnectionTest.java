package com.bibbidi.wedding.chat.controller.sse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.bibbidi.wedding.chat.controller.dto.resp.ChatResponse;
import com.bibbidi.wedding.chat.controller.sse.dto.SseEvent;
import com.bibbidi.wedding.chat.support.RecordingSseEmitter;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Duration;
import java.util.concurrent.CancellationException;
import java.util.concurrent.Future;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

class SseConnectionTest {

    private static final String SEND = RecordingSseEmitter.SEND;
    private static final String COMPLETE = RecordingSseEmitter.COMPLETE;
    private static final String REMEMBER = "remember";

    private RecordingSseEmitter emitter;
    private SseConnection connection;
    private Future<?> task;
    private Future<?> timer;

    private ListAppender<ILoggingEvent> logs;

    @BeforeEach
    void setUp() {
        emitter = new RecordingSseEmitter();
        connection = new SseConnection(emitter, System.nanoTime() + Duration.ofSeconds(30).toNanos());
        task = mock(Future.class);
        timer = mock(Future.class);
        connection.attachTask(task);
        connection.attachTimeout(timer);
        logs = new ListAppender<>();
        logs.start();
        ((Logger) LoggerFactory.getLogger(SseConnection.class)).addAppender(logs);
    }

    @AfterEach
    void tearDown() {
        ((Logger) LoggerFactory.getLogger(SseConnection.class)).detachAppender(logs);
    }

    @Test
    @DisplayName("AI 한도 초과로 실패하면 한도 초과 안내를 보내고 응답을 닫으며, WARN으로 기록한다")
    void capacityExceededSendsTheRetryFailureAndLogsWarn() {
        // when
        connection.fail(new BusinessException(ClientError.AI_CAPACITY_EXCEEDED, "호출 한도 초과"));

        // then
        assertThat(emitter.log()).containsExactly(SEND, COMPLETE);
        assertThat(emitter.sentData().getFirst()).contains(new ChatResponse.Failure(
                ClientError.AI_CAPACITY_EXCEEDED.errorCode(), ClientError.AI_CAPACITY_EXCEEDED.message()));
        assertThat(logs.list).extracting(ILoggingEvent::getLevel).containsExactly(Level.WARN);
        verify(timer).cancel(false);
    }

    @Test
    @DisplayName("예상하지 못한 오류로 실패하면 공통 오류 안내를 보내고 응답을 닫으며, ERROR로 기록한다")
    void unexpectedFailureSendsTheInternalErrorAndLogsError() {
        // when
        connection.fail(new IllegalStateException("외부 API 비밀 원문"));

        // then
        assertThat(emitter.log()).containsExactly(SEND, COMPLETE);
        assertThat(emitter.sentData().getFirst()).contains(new ChatResponse.Failure(
                ClientError.INTERNAL_ERROR.errorCode(), ClientError.INTERNAL_ERROR.message()));
        assertThat(logs.list).extracting(ILoggingEvent::getLevel).containsExactly(Level.ERROR);
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
        SseConnection expired = new SseConnection(emitter, System.nanoTime() - 1);
        Runnable remember = () -> emitter.log().add(REMEMBER);

        // when, then
        assertThatThrownBy(() -> expired.complete(new SseEvent(ChatEventType.DONE, "대화 ID"), remember))
                .isInstanceOf(CancellationException.class);
        assertThat(emitter.log()).isEmpty();
    }
}
