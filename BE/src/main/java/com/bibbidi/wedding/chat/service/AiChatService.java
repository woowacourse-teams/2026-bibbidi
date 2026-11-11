package com.bibbidi.wedding.chat.service;

import com.bibbidi.wedding.chat.service.dto.command.ChatCommand;
import com.bibbidi.wedding.chat.service.dto.result.ChatResult;
import com.bibbidi.wedding.chat.service.port.AiConversationPort;
import com.bibbidi.wedding.chat.service.subscriber.TurnSubscriber;
import com.bibbidi.wedding.chat.service.turn.CancelReason;
import com.bibbidi.wedding.chat.service.turn.ChatTurn;
import com.bibbidi.wedding.chat.service.turn.TurnContext;
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

@Service
public class AiChatService {

    private final AiConversationPort conversationPort;
    private final List<TurnSubscriber> turnSubscribers;
    private final Map<ConversationKey, ActiveRequest> activeConversations = new ConcurrentHashMap<>();

    public AiChatService(
            AiConversationPort conversationPort,
            List<TurnSubscriber> turnSubscribers
    ) {
        this.conversationPort = conversationPort;
        this.turnSubscribers = turnSubscribers;
    }

    public Flux<ChatResult> chat(
            ChatCommand chatCommand,
            Supplier<CancelReason> outputCancelReason
    ) {
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
                                    Flux.just(new ChatResult.Conversation(conversationId.toString())),
                                    Flux.defer(() -> streamReply(key, chatCommand.message(), cancelReason))
                            )
                            .takeUntilOther(current.newerRequestArrived().asMono())
                            .doFinally(ignored -> activeConversations.remove(key, current));
                }
        );
    }

    private Flux<ChatResult> streamReply(
            ConversationKey key,
            String message,
            Supplier<CancelReason> cancelReason
    ) {
        ChatTurn turn = new ChatTurn();
        TurnContext context = new TurnContext(key.userId(), key.conversationId(), message, LocalDateTime.now());
        List<Flux<ChatResult>> outputs = turnSubscribers.stream()
                .map(subscriber -> subscriber.subscribe(context, turn.results()))
                .toList();

        return Flux.merge(outputs)
                .doOnSubscribe(ignored -> turn.start(
                        conversationPort.stream(key.userId(), key.toMemoryKey(), message))
                )
                .doFinally(
                        signalType -> turn.cancel(
                                signalType == SignalType.CANCEL ? cancelReason.get() : CancelReason.CONSUMER_FAILED
                        )
                );
    }

    private record ActiveRequest(Sinks.Empty<Void> newerRequestArrived, AtomicBoolean replaced) {
    }
}
