package com.bibbidi.wedding.chat.service;

import com.bibbidi.wedding.chat.service.dto.ChatAnswer;
import com.bibbidi.wedding.chat.service.dto.ChatCommand;
import com.bibbidi.wedding.chat.service.dto.ChatEvent;
import com.bibbidi.wedding.chat.service.port.AiConversationPort;
import com.bibbidi.wedding.chat.service.turn.CancelReason;
import com.bibbidi.wedding.chat.service.turn.ChatTurn;
import com.bibbidi.wedding.chat.service.turn.TurnConsumer;
import com.bibbidi.wedding.chat.service.turn.TurnContext;
import com.bibbidi.wedding.chat.service.turn.TurnSignal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.SignalType;
import reactor.core.publisher.Sinks;
import reactor.core.scheduler.Schedulers;

@Service
public class AiChatService {

    private final AiConversationPort conversationPort;
    private final List<TurnConsumer> turnConsumers;
    private final Map<ConversationKey, ActiveRequest> activeConversations = new ConcurrentHashMap<>();

    public AiChatService(
            AiConversationPort conversationPort,
            List<TurnConsumer> turnConsumers
    ) {
        this.conversationPort = conversationPort;
        this.turnConsumers = turnConsumers;
    }

    public Flux<ChatEvent> chat(ChatCommand chatCommand, Supplier<CancelReason> outputCancelReason) {
        UUID conversationId = chatCommand.conversationId() == null ? UUID.randomUUID() : chatCommand.conversationId();
        ConversationKey key = new ConversationKey(chatCommand.userId(), conversationId);

        return Flux.defer(
                () -> {
                    ActiveRequest current = new AiChatService.ActiveRequest(Sinks.empty(), new AtomicBoolean());
                    ActiveRequest previous = activeConversations.put(key, current);
                    if (previous != null) {
                        previous.replaced().set(true);
                        previous.newerRequestArrived().tryEmitEmpty();
                    }
                    Supplier<CancelReason> cancelReason =
                            () -> current.replaced().get() ?
                                    CancelReason.SUPERSEDED
                                    : outputCancelReason.get();

                    return Flux.concat(
                                    Flux.just(new ChatEvent.Conversation(conversationId.toString())),
                                    Flux.defer(() -> streamReply(key, chatCommand.message(), cancelReason))
                            )
                            .takeUntilOther(current.newerRequestArrived().asMono())
                            .doFinally(ignored -> activeConversations.remove(key, current));
                }
        );
    }

    private Flux<ChatEvent> streamReply(
            ConversationKey key, String message, Supplier<CancelReason> cancelReason
    ) {
        ChatTurn turn = new ChatTurn(conversationPort.modelName());
        TurnContext context = new TurnContext(key.userId(), key.conversationId(), message, LocalDateTime.now());
        turnConsumers.forEach(consumer -> consumer.consume(context, turn.signals()));

        return turn.signals()
                .publishOn(Schedulers.boundedElastic())
                .concatMap(signal -> eventsOf(signal, key))
                .doOnSubscribe(ignored -> turn.start(
                        conversationPort.stream(key.userId(), key.toMemoryKey(), message))
                )
                .doFinally(
                        signalType -> turn.cancel(
                                signalType == SignalType.CANCEL ? cancelReason.get() : CancelReason.CONSUMER_FAILED
                        )
                );
    }

    private Flux<ChatEvent> eventsOf(TurnSignal signal, ConversationKey key) {
        return switch (signal) {
            case TurnSignal.Chunk chunk -> Flux.fromIterable(chunk.answerDeltas()).map(ChatEvent.Delta::new);
            case TurnSignal.Completed completed -> completeAnswer(key, completed.answer());
            case TurnSignal.Failed failed -> Flux.error(failed.cause());
            case TurnSignal.Cancelled ignored -> Flux.empty();
        };
    }

    private Flux<ChatEvent> completeAnswer(ConversationKey key, ChatAnswer answer) {
        Flux<ChatEvent> card = answer.recommendedItemIds().isEmpty()
                ? Flux.empty()
                : Flux.just(new ChatEvent.Component(answer.recommendedItemIds()));
        return Flux.concat(
                card,
                Flux.just(new ChatEvent.Done(key.conversationId().toString()))
        );
    }

    private record ActiveRequest(Sinks.Empty<Void> newerRequestArrived, AtomicBoolean replaced) {
    }
}
