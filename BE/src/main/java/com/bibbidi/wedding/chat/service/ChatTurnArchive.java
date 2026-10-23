package com.bibbidi.wedding.chat.service;

import com.bibbidi.wedding.chat.domain.ChatTurnOutcome;
import com.bibbidi.wedding.chat.domain.ChatTurnRecord;
import com.bibbidi.wedding.chat.repository.ChatTurnRepository;
import com.bibbidi.wedding.chat.service.turn.FailureReason;
import com.bibbidi.wedding.chat.service.turn.TurnConsumer;
import com.bibbidi.wedding.chat.service.turn.TurnContext;
import com.bibbidi.wedding.chat.service.turn.TurnSignal;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.scheduler.Scheduler;

@Component
@Slf4j
public class ChatTurnArchive implements TurnConsumer {

    private final ChatTurnRepository chatTurnRepository;
    private final Scheduler scheduler;
    private final Counter archiveFailures;

    public ChatTurnArchive(
            ChatTurnRepository chatTurnRepository,
            MeterRegistry registry,
            @Qualifier("chatTurnArchiveScheduler") Scheduler scheduler
    ) {
        this.chatTurnRepository = chatTurnRepository;
        this.scheduler = scheduler;
        this.archiveFailures = Counter.builder("ai.chat.archive.failures").register(registry);
    }

    @Override
    public void consume(TurnContext context, Flux<TurnSignal> signals) {
        StringBuilder completion = new StringBuilder();
        signals.publishOn(scheduler).subscribe(
                signal -> onSignal(context, completion, signal),
                this::onFailure
        );
    }

    private void onSignal(TurnContext context, StringBuilder completion, TurnSignal signal) {
        switch (signal) {
            case TurnSignal.Chunk chunk -> completion.append(chunk.text());
            case TurnSignal.Completed ignored -> archive(context, completion, ChatTurnOutcome.COMPLETED, null);
            case TurnSignal.Failed failed ->
                    archive(context, completion, ChatTurnOutcome.FAILED, FailureReason.of(failed.cause()).name());
            case TurnSignal.Cancelled cancelled ->
                    archive(context, completion, ChatTurnOutcome.CANCELLED, cancelled.reason().name());
        }
    }

    private void archive(
            TurnContext context,
            StringBuilder completion,
            ChatTurnOutcome outcome,
            @Nullable String outcomeReason
    ) {
        try {
            chatTurnRepository.save(
                    new ChatTurnRecord(
                            context.userId(),
                            context.conversationId(),
                            context.userPrompt(),
                            completion.toString(),
                            outcome,
                            outcomeReason,
                            context.startedAt()
                    )
            );
        } catch (RuntimeException exception) {
            onFailure(exception);
        }
    }

    private void onFailure(Throwable exception) {
        archiveFailures.increment();
        log.error("챗봇 턴 저장 실패. type={}", exception.getClass().getSimpleName());
    }
}
