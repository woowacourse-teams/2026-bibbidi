package com.bibbidi.wedding.chat.adapter.ai;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

@Component
public class AiChatStreamRecorder {

    private static final Logger CONTENT_LOG = LoggerFactory.getLogger("ai.chat.content");

    private final String model;
    private final Counter turns;
    private final Counter failures;
    private final Counter inputTokenCount;
    private final Counter outputTokenCount;
    private final Timer timeToFirstToken;

    public AiChatStreamRecorder(
            MeterRegistry registry,
            @Value("${spring.ai.bedrock.converse.chat.model}") String model
    ) {
        this.model = model;
        this.turns = Counter.builder("ai.chat.turns").register(registry);
        this.failures = Counter.builder("ai.chat.failures").register(registry);
        this.inputTokenCount = Counter.builder("ai.tokens").tag("model", model).tag("type", "input")
                .register(registry);
        this.outputTokenCount = Counter.builder("ai.tokens").tag("model", model).tag("type", "output")
                .register(registry);
        this.timeToFirstToken = Timer.builder("ai.chat.ttft").register(registry);
    }

    public Flux<ChatResponse> record(String userPrompt, Flux<ChatResponse> responses) {
        return Flux.defer(() -> {
            Turn turn = new Turn(userPrompt, System.nanoTime());
            return responses
                    .doOnNext(turn::onResponse)
                    .doOnComplete(() -> turn.finish("completed"))
                    .doOnError(exception -> {
                        failures.increment();
                        turn.finish("failed");
                    })
                    .doOnCancel(() -> turn.finish("cancelled"));
        });
    }

    static String textOf(ChatResponse response) {
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
        private final AtomicLong firstTokenNanos = new AtomicLong(-1);
        private final AtomicLong inputTokens = new AtomicLong();
        private final AtomicLong outputTokens = new AtomicLong();
        private final AtomicBoolean finished = new AtomicBoolean();

        private Turn(String userPrompt, long startedAtNanos) {
            this.userPrompt = userPrompt;
            this.startedAtNanos = startedAtNanos;
        }

        private void onResponse(ChatResponse response) {
            String text = textOf(response);
            if (!text.isEmpty()) {
                if (firstTokenNanos.compareAndSet(-1, System.nanoTime() - startedAtNanos)) {
                    timeToFirstToken.record(Duration.ofNanos(firstTokenNanos.get()));
                }
                completion.append(text);
            }
            rememberUsage(response);
        }

        private void rememberUsage(ChatResponse response) {
            Usage usage = response.getMetadata().getUsage();
            if (usage == null) {
                return;
            }
            long input = usage.getPromptTokens() == null ? 0 : usage.getPromptTokens();
            long output = usage.getCompletionTokens() == null ? 0 : usage.getCompletionTokens();
            if (input + output > 0) {
                inputTokens.set(input);
                outputTokens.set(output);
            }
        }

        private void finish(String outcome) {
            if (!finished.compareAndSet(false, true)) {
                return;
            }
            turns.increment();
            inputTokenCount.increment(inputTokens.get());
            outputTokenCount.increment(outputTokens.get());
            long durationMillis = Duration.ofNanos(System.nanoTime() - startedAtNanos).toMillis();
            long ttftNanos = firstTokenNanos.get();
            CONTENT_LOG.info(
                    "ai_chat_turn outcome={} model={} inputTokens={} outputTokens={} ttftMs={} durationMs={}"
                            + " prompt={} completion={}",
                    outcome, model, inputTokens.get(), outputTokens.get(),
                    ttftNanos < 0 ? -1 : Duration.ofNanos(ttftNanos).toMillis(), durationMillis,
                    userPrompt, completion);
        }
    }
}
