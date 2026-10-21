package com.bibbidi.wedding.chat.adapter.ai.observability;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import software.amazon.awssdk.services.bedrockruntime.model.ThrottlingException;

@Component
@Slf4j(topic = "ai.chat.content")
public class AiChatStreamRecorder {

    private static final String THROTTLED = "throttled";
    private static final String TIMEOUT = "timeout";
    private static final String ERROR = "error";

    private final String model;
    private final Counter turns;
    private final Counter completedTurns;
    private final Counter cancelledTurns;
    private final Map<String, Counter> failures;

    public AiChatStreamRecorder(
            MeterRegistry registry,
            @Value("${spring.ai.bedrock.converse.chat.model}") String model
    ) {
        this.model = model;
        this.turns = Counter.builder("ai.chat.turns").register(registry);
        this.completedTurns = Counter.builder("ai.chat.completed").register(registry);
        this.cancelledTurns = Counter.builder("ai.chat.cancelled").register(registry);
        this.failures = Map.of(
                THROTTLED, failureCounter(registry, THROTTLED),
                TIMEOUT, failureCounter(registry, TIMEOUT),
                ERROR, failureCounter(registry, ERROR)
        );
    }

    public Flux<ChatResponse> record(String userPrompt, Flux<ChatResponse> responses) {
        return Flux.defer(() -> {
            Turn turn = new Turn(userPrompt, System.nanoTime());
            return responses
                    .doOnNext(turn::onResponse)
                    .doOnComplete(() -> turn.finish("completed"))
                    .doOnError(exception -> {
                        failures.get(failureReasonOf(exception)).increment();
                        turn.finish("failed");
                    })
                    .doOnCancel(() -> turn.finish("cancelled"));
        });
    }

    private static Counter failureCounter(MeterRegistry registry, String reason) {
        return Counter.builder("ai.chat.failures").tag("reason", reason).register(registry);
    }

    private static String failureReasonOf(Throwable exception) {
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause instanceof ThrottlingException) {
                return THROTTLED;
            }
            if (cause instanceof TimeoutException) {
                return TIMEOUT;
            }
        }
        return ERROR;
    }

    public static String textOf(ChatResponse response) {
        if (response.getResult() == null
                || response.getResult().getOutput() == null
                || response.getResult().getOutput().getText() == null) {
            return "";
        }
        return response.getResult().getOutput().getText();
    }

    private final class Turn {

        private final String userPrompt;
        private final long startedAtNanos;
        private final StringBuffer completion = new StringBuffer();
        private final AtomicBoolean finished = new AtomicBoolean();

        private Turn(String userPrompt, long startedAtNanos) {
            this.userPrompt = userPrompt;
            this.startedAtNanos = startedAtNanos;
        }

        private void onResponse(ChatResponse response) {
            String text = textOf(response);
            if (!text.isEmpty()) {
                completion.append(text);
            }
        }

        private void finish(String outcome) {
            if (!finished.compareAndSet(false, true)) {
                return;
            }
            turns.increment();
            switch (outcome) {
                case "completed" -> completedTurns.increment();
                case "cancelled" -> cancelledTurns.increment();
                default -> {
                    // 실패는 별도 카운터에서 기록한다.
                }
            }
            long durationMillis = TimeUnit.NANOSECONDS.toMillis(
                    System.nanoTime() - startedAtNanos);
            log.info(
                    "ai_chat_turn outcome={} model={} durationMs={} prompt={} completion={}",
                    outcome, model, durationMillis,
                    userPrompt, completion);
        }
    }
}
