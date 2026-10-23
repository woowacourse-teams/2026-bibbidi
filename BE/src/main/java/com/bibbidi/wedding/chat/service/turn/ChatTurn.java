package com.bibbidi.wedding.chat.service.turn;

import com.bibbidi.wedding.chat.service.dto.ChatAnswer;
import com.bibbidi.wedding.chat.service.port.AiResponse;
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
    private @Nullable ChatAnswer answer;
    private @Nullable Disposable modelCall;

    public ChatTurn(String model) {
        this.model = model;
    }

    public Flux<TurnSignal> signals() {
        return sink.asFlux();
    }

    public void start(Flux<AiResponse> response) {
        Disposable call = response.subscribe(this::emitResponse, this::fail, this::complete);
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

    private void emitResponse(AiResponse response) {
        synchronized (lock) {
            if (!terminated) {
                if (response instanceof AiResponse.Chunk chunk) {
                    sink.tryEmitNext(new TurnSignal.Chunk(model, chunk.raw(), chunk.answerDeltas(), elapsed()));
                } else if (response instanceof AiResponse.Answer completed) {
                    answer = completed.value();
                }
            }
        }
    }

    private void fail(Throwable cause) {
        terminate(new TurnSignal.Failed(model, cause, elapsed()));
    }

    private void complete() {
        ChatAnswer completedAnswer;
        synchronized (lock) {
            completedAnswer = answer;
        }
        if (completedAnswer == null) {
            fail(new IllegalStateException("완료된 AI 응답이 없습니다."));
            return;
        }
        terminate(new TurnSignal.Completed(model, completedAnswer, elapsed()));
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
