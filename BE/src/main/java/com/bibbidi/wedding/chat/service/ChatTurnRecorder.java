package com.bibbidi.wedding.chat.service;

import com.bibbidi.wedding.chat.service.turn.FailureReason;
import com.bibbidi.wedding.chat.service.turn.TurnConsumer;
import com.bibbidi.wedding.chat.service.turn.TurnContext;
import com.bibbidi.wedding.chat.service.turn.TurnSignal;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Duration;
import java.util.EnumMap;
import java.util.Locale;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.scheduler.Scheduler;
import reactor.core.scheduler.Schedulers;

@Component
@Slf4j(topic = "ai.chat.content")
public class ChatTurnRecorder implements TurnConsumer {

    private final Scheduler scheduler;
    private final Counter turns;
    private final Counter completedTurns;
    private final Counter cancelledTurns;
    private final Map<FailureReason, Counter> failures = new EnumMap<>(FailureReason.class);

    @Autowired
    public ChatTurnRecorder(MeterRegistry registry) {
        this(registry, Schedulers.boundedElastic());
    }

    public ChatTurnRecorder(MeterRegistry registry, Scheduler scheduler) {
        this.scheduler = scheduler;
        this.turns = Counter.builder("ai.chat.turns").register(registry);
        this.completedTurns = Counter.builder("ai.chat.completed").register(registry);
        this.cancelledTurns = Counter.builder("ai.chat.cancelled").register(registry);
        for (FailureReason reason : FailureReason.values()) {
            failures.put(reason, Counter.builder("ai.chat.failures")
                    .tag("reason", reason.name().toLowerCase(Locale.ROOT))
                    .register(registry));
        }
    }

    @Override
    public void consume(TurnContext context, Flux<TurnSignal> signals) {
        Turn turn = new Turn(context.userPrompt());
        signals.publishOn(scheduler).subscribe(
                turn::onSignal,
                exception -> log.error("ai_chat_turn 기록 실패. type={}", exception.getClass().getSimpleName())
        );
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
                    failures.get(FailureReason.of(failed.cause())).increment();
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
