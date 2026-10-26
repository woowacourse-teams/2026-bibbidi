package com.bibbidi.wedding.chat.service.subscriber;

import com.bibbidi.wedding.chat.domain.ChatTurnOutcome;
import com.bibbidi.wedding.chat.domain.ChatTurnRecord;
import com.bibbidi.wedding.chat.repository.ChatTurnRepository;
import com.bibbidi.wedding.chat.service.dto.result.ChatResult;
import com.bibbidi.wedding.chat.service.turn.FailureReason;
import com.bibbidi.wedding.chat.service.turn.TurnContext;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import lombok.extern.slf4j.Slf4j;
import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.scheduler.Scheduler;

@Component
@Slf4j
public class ArchiveSubscriber implements TurnSubscriber {

    private static final String UNSELECTED_MODEL = "unselected";

    private final ChatTurnRepository chatTurnRepository;
    private final Scheduler scheduler;
    private final Clock clock;
    private final Counter archiveFailures;

    public ArchiveSubscriber(
            ChatTurnRepository chatTurnRepository,
            MeterRegistry registry,
            Clock clock,
            @Qualifier("chatTurnArchiveScheduler") Scheduler scheduler
    ) {
        this.chatTurnRepository = chatTurnRepository;
        this.scheduler = scheduler;
        this.clock = clock;
        this.archiveFailures = Counter.builder("ai.chat.archive.failures").register(registry);
    }

    @Override
    public Flux<ChatResult> subscribe(TurnContext context, Flux<ChatResult> results) {
        Turn turn = new Turn(context, clock.instant());
        results.publishOn(scheduler).subscribe(turn::onResult, this::onFailure);
        return Flux.empty();
    }

    private final class Turn {

        private final TurnContext context;
        private final Instant startedAt;
        private final StringBuilder completion = new StringBuilder();
        private String model = UNSELECTED_MODEL;

        private Turn(TurnContext context, Instant startedAt) {
            this.context = context;
            this.startedAt = startedAt;
        }

        private void onResult(ChatResult result) {
            switch (result) {
                case ChatResult.Selected selected -> model = selected.model();
                case ChatResult.Delta delta -> completion.append(delta.text());
                case ChatResult.Completed ignored -> archive(ChatTurnOutcome.COMPLETED, null);
                case ChatResult.Failed failed ->
                        archive(ChatTurnOutcome.FAILED, FailureReason.of(failed.cause()).name());
                case ChatResult.Cancelled cancelled -> archive(ChatTurnOutcome.CANCELLED, cancelled.reason().name());
                default -> {
                }
            }
        }

        private void archive(ChatTurnOutcome outcome, @Nullable String outcomeReason) {
            try {
                chatTurnRepository.save(
                        new ChatTurnRecord(
                                context.userId(),
                                context.conversationId(),
                                context.userPrompt(),
                                completion.toString(),
                                model,
                                outcome,
                                outcomeReason,
                                context.startedAt(),
                                Duration.between(startedAt, clock.instant()).toMillis()
                        )
                );
            } catch (RuntimeException exception) {
                onFailure(exception);
            }
        }
    }

    private void onFailure(Throwable exception) {
        archiveFailures.increment();
        log.error("챗봇 턴 저장 실패. type={}", exception.getClass().getSimpleName());
    }
}
