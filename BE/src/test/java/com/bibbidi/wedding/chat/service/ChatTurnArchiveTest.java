package com.bibbidi.wedding.chat.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.bibbidi.wedding.chat.domain.ChatTurnOutcome;
import com.bibbidi.wedding.chat.domain.ChatTurnRecord;
import com.bibbidi.wedding.chat.repository.ChatTurnRepository;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import reactor.core.publisher.Flux;
import reactor.core.scheduler.Scheduler;
import reactor.core.scheduler.Schedulers;

class ChatTurnArchiveTest {

    private static final String MODEL = "test-model";
    private static final TurnContext CONTEXT = new TurnContext(
            7L, UUID.fromString("7bf4d204-8331-439b-bd8f-271abc0eea99"), "질문", LocalDateTime.of(2026, 10, 22, 9, 0));

    private ChatTurnRepository repository;
    private SimpleMeterRegistry registry;
    private ChatTurnArchive archive;

    @BeforeEach
    void setUp() {
        repository = mock(ChatTurnRepository.class);
        registry = new SimpleMeterRegistry();
        archive = new ChatTurnArchive(repository, registry, Schedulers.immediate());
    }

    @Test
    @DisplayName("정상 완료한 턴은 이어 붙인 모델 출력과 함께 COMPLETED로 저장한다")
    void archivesACompletedTurn() {
        // when
        archive.consume(CONTEXT, Flux.just(
                new TurnSignal.Chunk(MODEL, "{\"answer\":\"웨딩홀 ", List.of(), Duration.ofMillis(100)),
                new TurnSignal.Chunk(MODEL, "계약\"}", List.of(), Duration.ofMillis(200)),
                new TurnSignal.Completed(MODEL, new ChatAnswer("웨딩홀 계약", List.of()), Duration.ofMillis(300))));

        // then
        ChatTurnRecord record = savedRecord();
        assertThat(record.userId()).isEqualTo(CONTEXT.userId());
        assertThat(record.conversationId()).isEqualTo(CONTEXT.conversationId());
        assertThat(record.userPrompt()).isEqualTo("질문");
        assertThat(record.completion()).isEqualTo("{\"answer\":\"웨딩홀 계약\"}");
        assertThat(record.outcome()).isEqualTo(ChatTurnOutcome.COMPLETED);
        assertThat(record.outcomeReason()).isNull();
        assertThat(record.startedAt()).isEqualTo(CONTEXT.startedAt());
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource({"CLIENT_DISCONNECTED", "SUPERSEDED", "RESPONSE_TIMEOUT", "CONSUMER_FAILED"})
    @DisplayName("취소된 턴은 그때까지의 출력과 취소 사유를 CANCELLED로 저장한다")
    void archivesACancelledTurnWithItsReason(CancelReason reason) {
        // when
        archive.consume(CONTEXT, Flux.just(
                new TurnSignal.Chunk(MODEL, "{\"answer\":\"일부", List.of(), Duration.ofMillis(100)),
                new TurnSignal.Cancelled(MODEL, reason, Duration.ofMillis(150))));

        // then
        ChatTurnRecord record = savedRecord();
        assertThat(record.completion()).isEqualTo("{\"answer\":\"일부");
        assertThat(record.outcome()).isEqualTo(ChatTurnOutcome.CANCELLED);
        assertThat(record.outcomeReason()).isEqualTo(reason.name());
    }

    @Test
    @DisplayName("한도 초과로 실패한 턴은 THROTTLED 사유로 저장한다")
    void archivesAThrottledFailure() {
        // when
        archive.consume(CONTEXT, Flux.just(new TurnSignal.Failed(
                MODEL, new BusinessException(ClientError.AI_CAPACITY_EXCEEDED, "호출 한도 초과"), Duration.ofMillis(10))));

        // then
        ChatTurnRecord record = savedRecord();
        assertThat(record.outcome()).isEqualTo(ChatTurnOutcome.FAILED);
        assertThat(record.outcomeReason()).isEqualTo("THROTTLED");
    }

    @Test
    @DisplayName("모델 호출 시간 초과로 실패한 턴은 TIMEOUT 사유로 저장한다")
    void archivesATimeoutFailure() {
        // when
        archive.consume(CONTEXT, Flux.just(
                new TurnSignal.Failed(MODEL, new TimeoutException("응답 시간 초과"), Duration.ofMillis(10))));

        // then
        assertThat(savedRecord().outcomeReason()).isEqualTo("TIMEOUT");
    }

    @Test
    @DisplayName("그 밖의 이유로 실패한 턴은 ERROR 사유로 저장한다")
    void archivesAnyOtherFailureAsError() {
        // when
        archive.consume(CONTEXT, Flux.just(
                new TurnSignal.Failed(MODEL, new IllegalStateException("모델 오류"), Duration.ofMillis(10))));

        // then
        assertThat(savedRecord().outcomeReason()).isEqualTo("ERROR");
    }

    @Test
    @DisplayName("첫 청크 전에 끝난 턴은 빈 출력으로 저장한다")
    void archivesATurnThatEndedBeforeTheFirstChunkWithEmptyCompletion() {
        // when
        archive.consume(CONTEXT, Flux.just(
                new TurnSignal.Cancelled(MODEL, CancelReason.CLIENT_DISCONNECTED, Duration.ofMillis(5))));

        // then
        assertThat(savedRecord().completion()).isEmpty();
    }

    @Test
    @DisplayName("종료 신호가 오기 전에는 저장하지 않는다")
    void doesNotArchiveBeforeTheTerminalSignal() {
        // when
        archive.consume(CONTEXT, Flux.just(new TurnSignal.Chunk(MODEL, "일부", List.of(), Duration.ofMillis(10))));

        // then
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("저장에 실패해도 예외를 밖으로 던지지 않고 실패 횟수를 센다")
    void countsArchiveFailuresWithoutPropagating() {
        // given
        doThrow(new IllegalStateException("DB 오류")).when(repository).save(any());

        // when
        archive.consume(CONTEXT, Flux.just(new TurnSignal.Completed(MODEL,
                new ChatAnswer("답변", List.of()), Duration.ofMillis(10))));

        // then
        assertThat(registry.get("ai.chat.archive.failures").counter().count()).isEqualTo(1);
    }

    @Test
    @DisplayName("저장용 스케줄러가 작업을 받지 못하면 저장하지 않고 실패 횟수를 센다")
    void countsArchiveFailuresWhenTheSchedulerRejectsTheWork() {
        // given
        Scheduler disposed = Schedulers.newSingle("disposed-archive");
        disposed.dispose();
        ChatTurnArchive rejected = new ChatTurnArchive(repository, registry, disposed);

        // when
        rejected.consume(CONTEXT, Flux.just(new TurnSignal.Completed(MODEL,
                new ChatAnswer("답변", List.of()), Duration.ofMillis(10))));

        // then
        verify(repository, never()).save(any());
        assertThat(registry.get("ai.chat.archive.failures").counter().count()).isEqualTo(1);
    }

    private ChatTurnRecord savedRecord() {
        ArgumentCaptor<ChatTurnRecord> captor = ArgumentCaptor.forClass(ChatTurnRecord.class);
        verify(repository).save(captor.capture());
        return captor.getValue();
    }
}
