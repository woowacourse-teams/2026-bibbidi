package com.bibbidi.wedding.chat.service.turn;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;
import reactor.test.publisher.TestPublisher;

class ChatTurnTest {

    @Test
    @DisplayName("모델 호출이 끝난 뒤에 구독해도 첫 청크부터 모두 받는다")
    void lateSubscriberReceivesEverySignal() {
        // given
        ChatTurn turn = new ChatTurn("test-model");
        turn.start(Flux.just("가", "나"));

        // when
        List<TurnSignal> signals = turn.signals().collectList().block();

        // then
        assertThat(signals).hasSize(3);
        assertThat(signals.get(0)).isInstanceOfSatisfying(TurnSignal.Chunk.class,
                chunk -> assertThat(chunk.text()).isEqualTo("가"));
        assertThat(signals.get(1)).isInstanceOfSatisfying(TurnSignal.Chunk.class,
                chunk -> assertThat(chunk.text()).isEqualTo("나"));
        assertThat(signals.get(2)).isInstanceOf(TurnSignal.Completed.class);
    }

    @Test
    @DisplayName("소비자마다 같은 신호와 같은 경과 시간을 받고 모델은 한 번만 구독한다")
    void consumersShareOneModelCall() {
        // given
        TestPublisher<String> model = TestPublisher.create();
        AtomicInteger subscriptions = new AtomicInteger();
        ChatTurn turn = new ChatTurn("test-model");
        turn.start(model.flux().doOnSubscribe(ignored -> subscriptions.incrementAndGet()));
        List<TurnSignal> first = new CopyOnWriteArrayList<>();
        turn.signals().subscribe(first::add);

        // when
        model.next("가");
        List<TurnSignal> second = new CopyOnWriteArrayList<>();
        turn.signals().subscribe(second::add);
        model.complete();

        // then
        assertThat(subscriptions).hasValue(1);
        assertThat(second).isEqualTo(first);
        assertThat(first).hasSize(2);
    }

    @Test
    @DisplayName("모델 호출이 실패하면 실패 신호 하나로 끝난다")
    void failureEndsWithOneFailedSignal() {
        // given
        IllegalStateException failure = new IllegalStateException("모델 오류");
        ChatTurn turn = new ChatTurn("test-model");
        turn.start(Flux.concat(Flux.just("가"), Flux.error(failure)));

        // when
        List<TurnSignal> signals = turn.signals().collectList().block();

        // then
        assertThat(signals).hasSize(2);
        assertThat(signals.getLast()).isInstanceOfSatisfying(TurnSignal.Failed.class,
                failed -> assertThat(failed.cause()).isSameAs(failure));
    }

    @Test
    @DisplayName("취소하면 모델 호출을 취소하고 사유가 담긴 취소 신호 하나로 끝난다")
    void cancelCancelsTheModelAndEmitsReason() {
        // given
        TestPublisher<String> model = TestPublisher.create();
        ChatTurn turn = new ChatTurn("test-model");
        turn.start(model.flux());

        // when
        turn.cancel(CancelReason.CLIENT_DISCONNECTED);
        turn.cancel(CancelReason.RESPONSE_TIMEOUT);

        // then
        model.assertCancelled();
        List<TurnSignal> signals = turn.signals().collectList().block();
        assertThat(signals).hasSize(1);
        assertThat(signals.getFirst()).isInstanceOfSatisfying(TurnSignal.Cancelled.class,
                cancelled -> assertThat(cancelled.reason()).isEqualTo(CancelReason.CLIENT_DISCONNECTED));
    }

    @Test
    @DisplayName("종료한 뒤 도착한 청크와 취소는 무시한다")
    void ignoresSignalsAfterTermination() {
        // given
        TestPublisher<String> model = TestPublisher.createNoncompliant(TestPublisher.Violation.DEFER_CANCELLATION);
        ChatTurn turn = new ChatTurn("test-model");
        turn.start(model.flux());
        model.next("가").complete();

        // when
        model.next("늦은 청크");
        turn.cancel(CancelReason.SUPERSEDED);

        // then
        List<TurnSignal> signals = turn.signals().collectList().block();
        assertThat(signals).hasSize(2);
        assertThat(signals.getLast()).isInstanceOf(TurnSignal.Completed.class);
    }

    @Test
    @DisplayName("시작하기 전에 취소하면 모델을 구독하지 않는다")
    void cancelBeforeStartSkipsTheModelCall() {
        // given
        TestPublisher<String> model = TestPublisher.create();
        ChatTurn turn = new ChatTurn("test-model");

        // when
        turn.cancel(CancelReason.SUPERSEDED);
        turn.start(model.flux());

        // then
        model.assertCancelled();
    }
}
