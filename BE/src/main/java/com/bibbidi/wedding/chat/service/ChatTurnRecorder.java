package com.bibbidi.wedding.chat.service;

import com.bibbidi.wedding.chat.service.turn.TurnSignal;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.TimeoutException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

@Component
@Slf4j(topic = "ai.chat.content")
public class ChatTurnRecorder {

    private static final String THROTTLED = "throttled";
    private static final String TIMEOUT = "timeout";
    private static final String ERROR = "error";

    private final Counter turns;
    private final Counter completedTurns;
    private final Counter cancelledTurns;
    private final Map<String, Counter> failures;

    public ChatTurnRecorder(MeterRegistry registry) {
        this.turns = Counter.builder("ai.chat.turns").register(registry);
        this.completedTurns = Counter.builder("ai.chat.completed").register(registry);
        this.cancelledTurns = Counter.builder("ai.chat.cancelled").register(registry);
        this.failures = Map.of(
                THROTTLED, failureCounter(registry, THROTTLED),
                TIMEOUT, failureCounter(registry, TIMEOUT),
                ERROR, failureCounter(registry, ERROR)
        );
    }

    public void record(String userPrompt, Flux<TurnSignal> signals) {
        Turn turn = new Turn(userPrompt);
        signals.subscribe(
                turn::onSignal,
                exception -> log.error("ai_chat_turn 기록 실패. type={}", exception.getClass().getSimpleName())
        );
    }

    private static Counter failureCounter(MeterRegistry registry, String reason) {
        return Counter.builder("ai.chat.failures").tag("reason", reason).register(registry);
    }

    private static String failureReasonOf(Throwable exception) {
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause instanceof BusinessException business
                    && business.clientError() == ClientError.AI_CAPACITY_EXCEEDED) {
                return THROTTLED;
            }
            if (cause instanceof TimeoutException) {
                return TIMEOUT;
            }
        }
        return ERROR;
    }

    private final class Turn {

        private final String userPrompt;
        private final StringBuilder completion = new StringBuilder();
        private Duration firstChunkElapsed;

        private Turn(String userPrompt) {
            this.userPrompt = userPrompt;
        }

        private void onSignal(TurnSignal signal) {
            switch (signal) {
                case TurnSignal.Chunk chunk -> {
                    if (firstChunkElapsed == null) {
                        firstChunkElapsed = chunk.elapsed();
                    }
                    completion.append(chunk.text());
                }
                case TurnSignal.Completed completed -> {
                    completedTurns.increment();
                    finish("completed", completed, "-");
                }
                case TurnSignal.Failed failed -> {
                    failures.get(failureReasonOf(failed.cause())).increment();
                    finish("failed", failed, "-");
                }
                case TurnSignal.Cancelled cancelled -> {
                    cancelledTurns.increment();
                    finish("cancelled", cancelled, cancelled.reason().name());
                }
            }
        }

        private void finish(String outcome, TurnSignal terminal, String cancelReason) {
            turns.increment();
            String firstChunkMillis = firstChunkElapsed == null ? "-" : String.valueOf(firstChunkElapsed.toMillis());
            log.info(
                    "ai_chat_turn outcome={} model={} durationMs={} firstChunkMs={} cancelReason={} prompt={} completion={}",
                    outcome, terminal.model(), terminal.elapsed().toMillis(), firstChunkMillis, cancelReason,
                    userPrompt, completion);
        }
    }
}
