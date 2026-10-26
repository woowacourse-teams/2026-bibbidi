package com.bibbidi.wedding.chat.service.turn;

import com.bibbidi.wedding.chat.service.dto.result.ChatResult;
import java.util.function.Supplier;
import org.jspecify.annotations.Nullable;
import reactor.core.Disposable;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;

/**
 * 모델 호출 한 번의 결과를 턴별 replay sink에 담아 구독자들이 각자 읽게 한다.
 * 종료 사건(완료·실패·취소)은 정확히 하나만 나가고, 그 뒤의 사건은 버린다.
 */
public final class ChatTurn {

    private final Sinks.Many<ChatResult> sink = Sinks.many().replay().all();
    private final Object lock = new Object();
    private boolean terminated;
    private boolean answered;
    private @Nullable Disposable modelCall;

    public Flux<ChatResult> results() {
        return sink.asFlux();
    }

    public void start(Flux<ChatResult> response) {
        Disposable call = response.subscribe(this::emit, this::fail, this::complete);
        synchronized (lock) {
            if (!terminated) {
                modelCall = call;
                return;
            }
        }
        call.dispose();
    }

    public void cancel(CancelReason reason) {
        terminate(() -> new ChatResult.Cancelled(reason));
    }

    private void emit(ChatResult result) {
        synchronized (lock) {
            if (terminated) {
                return;
            }
            if (result instanceof ChatResult.Answer) {
                answered = true;
            }
            sink.tryEmitNext(result);
        }
    }

    private void fail(Throwable cause) {
        terminate(() -> new ChatResult.Failed(cause));
    }

    private void complete() {
        terminate(() -> answered
                ? new ChatResult.Completed()
                : new ChatResult.Failed(new IllegalStateException("완료된 AI 응답이 없습니다.")));
    }

    private void terminate(Supplier<ChatResult> terminal) {
        Disposable call;
        synchronized (lock) {
            if (terminated) {
                return;
            }
            terminated = true;
            sink.tryEmitNext(terminal.get());
            sink.tryEmitComplete();
            call = modelCall;
        }
        if (call != null) {
            call.dispose();
        }
    }
}
