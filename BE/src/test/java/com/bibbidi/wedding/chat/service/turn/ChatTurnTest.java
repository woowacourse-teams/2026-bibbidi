package com.bibbidi.wedding.chat.service.turn;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.chat.service.dto.result.ChatResult;
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
    void lateSubscriberReceivesEveryResult() {
        // given
        ChatTurn turn = new ChatTurn();
        turn.start(Flux.just(chunk("가"), chunk("나"), answer("가나")));

        // when
        List<ChatResult> signals = turn.results().collectList().block();

        // then
        assertThat(signals).containsExactly(
                new ChatResult.Delta("가"),
                new ChatResult.Delta("나"),
                new ChatResult.Answer("가나", List.of()),
                new ChatResult.Completed());
    }

    @Test
    @DisplayName("구독자마다 같은 결과를 받고 모델은 한 번만 구독한다")
    void consumersShareOneModelCall() {
        // given
        TestPublisher<ChatResult> model = TestPublisher.create();
        AtomicInteger subscriptions = new AtomicInteger();
        ChatTurn turn = new ChatTurn();
        turn.start(model.flux().doOnSubscribe(ignored -> subscriptions.incrementAndGet()));
        List<ChatResult> first = new CopyOnWriteArrayList<>();
        turn.results().subscribe(first::add);

        // when
        model.next(chunk("가"));
        List<ChatResult> second = new CopyOnWriteArrayList<>();
        turn.results().subscribe(second::add);
        model.next(answer("가")).complete();

        // then
        assertThat(subscriptions).hasValue(1);
        assertThat(second).isEqualTo(first);
        assertThat(first).hasSize(3);
    }

    @Test
    @DisplayName("모델 호출이 실패하면 실패 신호 하나로 끝난다")
    void failureEndsWithOneFailedSignal() {
        // given
        IllegalStateException failure = new IllegalStateException("모델 오류");
        ChatTurn turn = new ChatTurn();
        turn.start(Flux.concat(Flux.just(chunk("가")), Flux.error(failure)));

        // when
        List<ChatResult> signals = turn.results().collectList().block();

        // then
        assertThat(signals).hasSize(2);
        assertThat(signals.getLast()).isInstanceOfSatisfying(ChatResult.Failed.class,
                failed -> assertThat(failed.cause()).isSameAs(failure));
    }

    @Test
    @DisplayName("취소하면 모델 호출을 취소하고 사유가 담긴 취소 신호 하나로 끝난다")
    void cancelCancelsTheModelAndEmitsReason() {
        // given
        TestPublisher<ChatResult> model = TestPublisher.create();
        ChatTurn turn = new ChatTurn();
        turn.start(model.flux());

        // when
        turn.cancel(CancelReason.CLIENT_DISCONNECTED);
        turn.cancel(CancelReason.RESPONSE_TIMEOUT);

        // then
        model.assertCancelled();
        List<ChatResult> signals = turn.results().collectList().block();
        assertThat(signals).hasSize(1);
        assertThat(signals.getFirst()).isInstanceOfSatisfying(ChatResult.Cancelled.class,
                cancelled -> assertThat(cancelled.reason()).isEqualTo(CancelReason.CLIENT_DISCONNECTED));
    }

    @Test
    @DisplayName("종료한 뒤 도착한 청크와 취소는 무시한다")
    void ignoresSignalsAfterTermination() {
        // given
        TestPublisher<ChatResult> model = TestPublisher.createNoncompliant(TestPublisher.Violation.DEFER_CANCELLATION);
        ChatTurn turn = new ChatTurn();
        turn.start(model.flux());
        model.next(chunk("가"), answer("가")).complete();

        // when
        model.next(chunk("늦은 청크"));
        turn.cancel(CancelReason.SUPERSEDED);

        // then
        List<ChatResult> signals = turn.results().collectList().block();
        assertThat(signals).hasSize(3);
        assertThat(signals.getLast()).isInstanceOf(ChatResult.Completed.class);
    }

    @Test
    @DisplayName("시작하기 전에 취소하면 모델을 구독하지 않는다")
    void cancelBeforeStartSkipsTheModelCall() {
        // given
        TestPublisher<ChatResult> model = TestPublisher.create();
        ChatTurn turn = new ChatTurn();

        // when
        turn.cancel(CancelReason.SUPERSEDED);
        turn.start(model.flux());

        // then
        model.assertCancelled();
    }

    private static ChatResult chunk(String text) {
        return new ChatResult.Delta(text);
    }

    private static ChatResult answer(String text) {
        return new ChatResult.Answer(text, List.of());
    }

    @Test
    @DisplayName("답변 없이 모델 호출이 끝나면 실패로 끝난다")
    void completionWithoutAnswerFails() {
        // given
        ChatTurn turn = new ChatTurn();
        turn.start(Flux.just(chunk("가")));

        // when
        List<ChatResult> results = turn.results().collectList().block();

        // then
        assertThat(results.getLast()).isInstanceOf(ChatResult.Failed.class);
    }
}
