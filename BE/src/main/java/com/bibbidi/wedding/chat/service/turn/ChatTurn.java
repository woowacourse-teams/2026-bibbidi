package com.bibbidi.wedding.chat.service.turn;

import java.time.Duration;
import org.jspecify.annotations.Nullable;
import reactor.core.Disposable;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;

/**
 * 모델 호출 한 번의 결과를 턴별 replay sink에 담아 소비자들이 각자 읽게 한다.
 * 종료 신호(완료·실패·취소)는 정확히 하나만 나가고, 그 뒤의 신호는 버린다.
 */
public final class ChatTurn {

    private final String model;
    private final Sinks.Many<TurnSignal> sink = Sinks.many().replay().all();
    private final long startedAtNanos = System.nanoTime();
    private final Object lock = new Object();
    private boolean terminated;
    private @Nullable Disposable modelCall;

    public ChatTurn(String model) {
        this.model = model;
    }

    public Flux<TurnSignal> signals() {
        return sink.asFlux();
    }

    public void start(Flux<String> response) {
        Disposable call = response.subscribe(this::emitChunk, this::fail, this::complete);
        synchronized (lock) {
            if (!terminated) {
                modelCall = call;
                return;
            }
        }
        call.dispose();
    }

    public void cancel(CancelReason reason) {
        terminate(new TurnSignal.Cancelled(model, reason, elapsed()));
    }

    private void emitChunk(String text) {
        synchronized (lock) {
            if (!terminated) {
                sink.tryEmitNext(new TurnSignal.Chunk(model, text, elapsed()));
            }
        }
    }

    private void fail(Throwable cause) {
        terminate(new TurnSignal.Failed(model, cause, elapsed()));
    }

    private void complete() {
        terminate(new TurnSignal.Completed(model, elapsed()));
    }

    private void terminate(TurnSignal signal) {
        Disposable call;
        synchronized (lock) {
            if (terminated) {
                return;
            }
            terminated = true;
            sink.tryEmitNext(signal);
            sink.tryEmitComplete();
            call = modelCall;
        }
        if (call != null) {
            call.dispose();
        }
    }

    private Duration elapsed() {
        return Duration.ofNanos(System.nanoTime() - startedAtNanos);
    }
}
