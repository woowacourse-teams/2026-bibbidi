package com.bibbidi.wedding.chat.service.subscriber;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.bibbidi.wedding.chat.domain.ChatTurnOutcome;
import com.bibbidi.wedding.chat.domain.ChatTurnRecord;
import com.bibbidi.wedding.chat.repository.ChatTurnRepository;
import com.bibbidi.wedding.chat.service.dto.result.ChatResult;
import com.bibbidi.wedding.chat.service.turn.CancelReason;
import com.bibbidi.wedding.chat.service.turn.TurnContext;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;
import reactor.core.scheduler.Scheduler;
import reactor.core.scheduler.Schedulers;

class ArchiveSubscriberTest {

    private static final String MODEL = "test-model";
    private static final TurnContext CONTEXT = new TurnContext(
            7L, UUID.fromString("7bf4d204-8331-439b-bd8f-271abc0eea99"), "질문", LocalDateTime.of(2026, 10, 22, 9, 0));

    private ChatTurnRepository repository;
    private SimpleMeterRegistry registry;
    private AdvancingClock clock;
    private ArchiveSubscriber archive;

    @BeforeEach
    void setUp() {
        repository = mock(ChatTurnRepository.class);
        registry = new SimpleMeterRegistry();
        clock = new AdvancingClock();
        archive = new ArchiveSubscriber(repository, registry, clock, Schedulers.immediate());
    }

    @Test
    @DisplayName("정상 완료한 턴은 이어 붙인 답변, 선택된 모델, 소요 시간과 함께 COMPLETED로 저장한다")
    void archivesACompletedTurn() {
        // given
        Sinks.Many<ChatResult> sink = Sinks.many().unicast().onBackpressureBuffer();
        archive.subscribe(CONTEXT, sink.asFlux());

        // when
        sink.tryEmitNext(new ChatResult.Selected(MODEL));
        sink.tryEmitNext(new ChatResult.Delta("웨딩홀 "));
        sink.tryEmitNext(new ChatResult.Delta("계약"));
        sink.tryEmitNext(new ChatResult.Answer("웨딩홀 계약", List.of()));
        clock.advance(Duration.ofMillis(1_234));
        sink.tryEmitNext(new ChatResult.Completed());

        // then
        ChatTurnRecord record = savedRecord();
        assertThat(record.userId()).isEqualTo(CONTEXT.userId());
        assertThat(record.conversationId()).isEqualTo(CONTEXT.conversationId());
        assertThat(record.userPrompt()).isEqualTo("질문");
        assertThat(record.completion()).isEqualTo("웨딩홀 계약");
        assertThat(record.model()).isEqualTo(MODEL);
        assertThat(record.outcome()).isEqualTo(ChatTurnOutcome.COMPLETED);
        assertThat(record.outcomeReason()).isNull();
        assertThat(record.startedAt()).isEqualTo(CONTEXT.startedAt());
        assertThat(record.durationMs()).isEqualTo(1_234);
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource({"CLIENT_DISCONNECTED", "SUPERSEDED", "RESPONSE_TIMEOUT", "CONSUMER_FAILED"})
    @DisplayName("취소된 턴은 그때까지의 답변과 취소 사유를 CANCELLED로 저장한다")
    void archivesACancelledTurnWithItsReason(CancelReason reason) {
        // when
        archive.subscribe(CONTEXT, Flux.just(
                new ChatResult.Selected(MODEL),
                new ChatResult.Delta("일부"),
                new ChatResult.Cancelled(reason)));

        // then
        ChatTurnRecord record = savedRecord();
        assertThat(record.completion()).isEqualTo("일부");
        assertThat(record.outcome()).isEqualTo(ChatTurnOutcome.CANCELLED);
        assertThat(record.outcomeReason()).isEqualTo(reason.name());
    }

    @Test
    @DisplayName("한도 초과로 실패한 턴은 THROTTLED 사유로 저장한다")
    void archivesAThrottledFailure() {
        // when
        archive.subscribe(CONTEXT, Flux.just(new ChatResult.Failed(
                new BusinessException(ClientError.AI_CAPACITY_EXCEEDED, "호출 한도 초과"))));

        // then
        ChatTurnRecord record = savedRecord();
        assertThat(record.outcome()).isEqualTo(ChatTurnOutcome.FAILED);
        assertThat(record.outcomeReason()).isEqualTo("THROTTLED");
    }

    @Test
    @DisplayName("모델 호출 시간 초과로 실패한 턴은 TIMEOUT 사유로 저장한다")
    void archivesATimeoutFailure() {
        // when
        archive.subscribe(CONTEXT, Flux.just(new ChatResult.Failed(new TimeoutException("응답 시간 초과"))));

        // then
        assertThat(savedRecord().outcomeReason()).isEqualTo("TIMEOUT");
    }

    @Test
    @DisplayName("그 밖의 이유로 실패한 턴은 ERROR 사유로 저장한다")
    void archivesAnyOtherFailureAsError() {
        // when
        archive.subscribe(CONTEXT, Flux.just(new ChatResult.Failed(new IllegalStateException("모델 오류"))));

        // then
        assertThat(savedRecord().outcomeReason()).isEqualTo("ERROR");
    }

    @Test
    @DisplayName("모델을 고르기 전에 끝난 턴은 빈 답변과 unselected 모델로 저장한다")
    void archivesATurnThatEndedBeforeModelSelection() {
        // when
        archive.subscribe(CONTEXT, Flux.just(new ChatResult.Cancelled(CancelReason.CLIENT_DISCONNECTED)));

        // then
        ChatTurnRecord record = savedRecord();
        assertThat(record.completion()).isEmpty();
        assertThat(record.model()).isEqualTo("unselected");
    }

    @Test
    @DisplayName("종료 사건이 오기 전에는 저장하지 않는다")
    void doesNotArchiveBeforeTheTerminalResult() {
        // when
        archive.subscribe(CONTEXT, Flux.just(new ChatResult.Delta("일부")));

        // then
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("저장에 실패해도 예외를 밖으로 던지지 않고 실패 횟수를 센다")
    void countsArchiveFailuresWithoutPropagating() {
        // given
        doThrow(new IllegalStateException("DB 오류")).when(repository).save(any());

        // when
        archive.subscribe(CONTEXT, Flux.just(new ChatResult.Completed()));

        // then
        assertThat(registry.get("ai.chat.archive.failures").counter().count()).isEqualTo(1);
    }

    @Test
    @DisplayName("저장용 스케줄러가 작업을 받지 못하면 저장하지 않고 실패 횟수를 센다")
    void countsArchiveFailuresWhenTheSchedulerRejectsTheWork() {
        // given
        Scheduler disposed = Schedulers.newSingle("disposed-archive");
        disposed.dispose();
        ArchiveSubscriber rejected = new ArchiveSubscriber(repository, registry, clock, disposed);

        // when
        rejected.subscribe(CONTEXT, Flux.just(new ChatResult.Completed()));

        // then
        verify(repository, never()).save(any());
        assertThat(registry.get("ai.chat.archive.failures").counter().count()).isEqualTo(1);
    }

    private ChatTurnRecord savedRecord() {
        ArgumentCaptor<ChatTurnRecord> captor = ArgumentCaptor.forClass(ChatTurnRecord.class);
        verify(repository).save(captor.capture());
        return captor.getValue();
    }

    private static final class AdvancingClock extends Clock {

        private Instant now = Instant.parse("2026-10-22T00:00:00Z");

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
