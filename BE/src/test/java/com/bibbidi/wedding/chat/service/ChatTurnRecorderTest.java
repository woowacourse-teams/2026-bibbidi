package com.bibbidi.wedding.chat.service;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.bibbidi.wedding.chat.service.dto.ChatAnswer;
import com.bibbidi.wedding.chat.service.turn.CancelReason;
import com.bibbidi.wedding.chat.service.turn.TurnContext;
import com.bibbidi.wedding.chat.service.turn.TurnSignal;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import reactor.core.publisher.Flux;
import reactor.core.scheduler.Schedulers;

class ChatTurnRecorderTest {

    private static final String MODEL = "test-model";
    private static final TurnContext CONTEXT = new TurnContext(
            7L, UUID.fromString("7bf4d204-8331-439b-bd8f-271abc0eea99"), "질문", LocalDateTime.of(2026, 10, 22, 9, 0));

    private final ListAppender<ILoggingEvent> logs = new ListAppender<>();
    private final Logger logger = (Logger) LoggerFactory.getLogger("ai.chat.content");
    private SimpleMeterRegistry registry;
    private ChatTurnRecorder recorder;

    @BeforeEach
    void setUp() {
        registry = new SimpleMeterRegistry();
        recorder = new ChatTurnRecorder(registry, Schedulers.immediate());
        logger.setLevel(Level.INFO);
        logs.start();
        logger.addAppender(logs);
    }

    @AfterEach
    void tearDown() {
        logger.detachAppender(logs);
    }

    @Test
    @DisplayName("답변을 마치면 완료한 대화 수와 첫 청크까지 시간, 총 소요 시간을 기록한다")
    void recordsCompletedTurnWithTimings() {
        // when
        recorder.consume(CONTEXT, Flux.just(
                new TurnSignal.Chunk(MODEL, "웨딩홀 ", List.of(), Duration.ofMillis(120)),
                new TurnSignal.Chunk(MODEL, "계약", List.of(), Duration.ofMillis(300)),
                new TurnSignal.Completed(MODEL, new ChatAnswer("웨딩홀 계약", List.of()), Duration.ofMillis(900))));

        // then
        assertThat(count("ai.chat.turns")).isEqualTo(1);
        assertThat(count("ai.chat.completed")).isEqualTo(1);
        assertThat(count("ai.chat.cancelled")).isZero();
        assertThat(failureCount("throttled") + failureCount("timeout") + failureCount("error")).isZero();
        assertThat(lastLog()).contains("outcome=completed", "durationMs=900", "firstChunkMs=120",
                "model=test-model", "prompt=질문", "completion=웨딩홀 계약");
    }

    @Test
    @DisplayName("답변 조각 없이 끝나면 첫 청크 시간을 남기지 않는다")
    void doesNotRecordFirstChunkTimeWithoutChunks() {
        // when
        recorder.consume(CONTEXT, Flux.just(new TurnSignal.Completed(MODEL,
                new ChatAnswer("답변", List.of()), Duration.ofMillis(50))));

        // then
        assertThat(lastLog()).contains("firstChunkMs=-");
    }

    @Test
    @DisplayName("모델이 실패하면 error 사유의 실패 횟수를 기록한다")
    void recordsFailure() {
        // when
        recorder.consume(CONTEXT, Flux.just(
                new TurnSignal.Chunk(MODEL, "웨딩홀 ", List.of(), Duration.ofMillis(10)),
                new TurnSignal.Failed(MODEL, new IllegalStateException("모델 오류"), Duration.ofMillis(20))));

        // then
        assertThat(failureCount("error")).isEqualTo(1);
        assertThat(failureCount("throttled")).isZero();
        assertThat(failureCount("timeout")).isZero();
        assertThat(count("ai.chat.turns")).isEqualTo(1);
        assertThat(count("ai.chat.completed")).isZero();
        assertThat(count("ai.chat.cancelled")).isZero();
        assertThat(lastLog()).contains("outcome=failed");
    }

    @Test
    @DisplayName("모델이 한도 초과로 실패하면 throttled 사유로 기록한다")
    void recordsThrottledFailure() {
        // given
        BusinessException throttling = new BusinessException(ClientError.AI_CAPACITY_EXCEEDED, "호출 한도 초과");

        // when
        recorder.consume(CONTEXT, Flux.just(
                new TurnSignal.Failed(MODEL, new IllegalStateException("감쌈", throttling), Duration.ofMillis(20))));

        // then
        assertThat(failureCount("throttled")).isEqualTo(1);
        assertThat(failureCount("timeout")).isZero();
        assertThat(failureCount("error")).isZero();
    }

    @Test
    @DisplayName("모델 응답이 시간 초과로 실패하면 timeout 사유로 기록한다")
    void recordsTimeoutFailure() {
        // when
        recorder.consume(CONTEXT, Flux.just(
                new TurnSignal.Failed(MODEL, new TimeoutException("응답 시간 초과"), Duration.ofMillis(20))));

        // then
        assertThat(failureCount("timeout")).isEqualTo(1);
        assertThat(failureCount("throttled")).isZero();
        assertThat(failureCount("error")).isZero();
    }

    @Test
    @DisplayName("취소되면 취소 횟수와 사유를 기록한다")
    void recordsCancellationWithReason() {
        // when
        recorder.consume(CONTEXT, Flux.just(
                new TurnSignal.Chunk(MODEL, "답변", List.of(), Duration.ofMillis(10)),
                new TurnSignal.Cancelled(MODEL, CancelReason.RESPONSE_TIMEOUT, Duration.ofMillis(30))));

        // then
        assertThat(count("ai.chat.turns")).isEqualTo(1);
        assertThat(count("ai.chat.completed")).isZero();
        assertThat(count("ai.chat.cancelled")).isEqualTo(1);
        assertThat(failureCount("throttled") + failureCount("timeout") + failureCount("error")).isZero();
        assertThat(lastLog()).contains("outcome=cancelled", "cancelReason=RESPONSE_TIMEOUT");
    }

    private double count(String name) {
        return registry.get(name).counter().count();
    }

    private double failureCount(String reason) {
        return registry.get("ai.chat.failures").tag("reason", reason).counter().count();
    }

    private String lastLog() {
        return logs.list.getLast().getFormattedMessage();
    }
}
