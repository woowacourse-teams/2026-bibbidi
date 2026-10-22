package com.bibbidi.wedding.chat.service;

import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.chat.service.dto.ChatAnswer;
import com.bibbidi.wedding.chat.service.dto.ChatCommand;
import com.bibbidi.wedding.chat.service.dto.ChatEvent;
import com.bibbidi.wedding.chat.service.dto.ChecklistSnapshot;
import com.bibbidi.wedding.chat.service.parser.JacksonChatAnswerParser;
import com.bibbidi.wedding.chat.service.parser.ReactiveChatAnswerStream;
import com.bibbidi.wedding.chat.service.port.AiConversationPort;
import com.bibbidi.wedding.chat.service.port.CatalogLookupPort;
import com.bibbidi.wedding.chat.service.port.ChecklistLookupPort;
import com.bibbidi.wedding.chat.service.turn.CancelReason;
import com.bibbidi.wedding.chat.service.turn.ChatTurn;
import com.bibbidi.wedding.chat.service.turn.TurnConsumer;
import com.bibbidi.wedding.chat.service.turn.TurnContext;
import com.bibbidi.wedding.chat.service.turn.TurnSignal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
    private final CatalogLookupPort catalogLookup;
    private final ChecklistLookupPort checklistLookup;
    private final JacksonChatAnswerParser answerParser;
    private final Map<ConversationKey, ActiveRequest> activeConversations = new ConcurrentHashMap<>();

    public AiChatService(
            AiConversationPort conversationPort,
            List<TurnConsumer> turnConsumers,
            CatalogLookupPort catalogLookup,
            ChecklistLookupPort checklistLookup,
            JacksonChatAnswerParser answerParser
    ) {
        this.conversationPort = conversationPort;
        this.turnConsumers = turnConsumers;
        this.catalogLookup = catalogLookup;
        this.checklistLookup = checklistLookup;
        this.answerParser = answerParser;
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

        return eventsFrom(turn, key)
                .doOnSubscribe(ignored -> turn.start(
                        conversationPort.stream(key.userId(), key.toMemoryKey(), message))
                )
                .doFinally(signalType -> cancelUnfinishedTurn(turn, signalType, cancelReason));
    }

    private Flux<ChatEvent> eventsFrom(ChatTurn turn, ConversationKey key) {
        List<String> deltas = new ArrayList<>();
        ReactiveChatAnswerStream answer = answerParser.newSession(deltas::add);

        return turn.signals()
                .publishOn(Schedulers.boundedElastic())
                .concatMap(signal -> eventsOf(signal, key, answer, deltas));
    }

    private void cancelUnfinishedTurn(ChatTurn turn, SignalType signalType, Supplier<CancelReason> cancelReason) {
        turn.cancel(signalType == SignalType.CANCEL ? cancelReason.get() : CancelReason.CONSUMER_FAILED);
    }

    private Flux<ChatEvent> eventsOf(
            TurnSignal signal, ConversationKey key, ReactiveChatAnswerStream answer, List<String> deltas
    ) {
        return switch (signal) {
            case TurnSignal.Chunk chunk -> {
                deltas.clear();
                answer.accept(chunk.text());
                List<ChatEvent> events = new ArrayList<>();
                for (String delta : deltas) {
                    events.add(new ChatEvent.Delta(delta));
                }
                yield Flux.fromIterable(events);
            }
            case TurnSignal.Completed ignored -> completeAnswer(key, answer);
            case TurnSignal.Failed failed -> Flux.error(failed.cause());
            case TurnSignal.Cancelled ignored -> Flux.empty();
        };
    }

    private Set<Long> loadRecommendableItemIds(Long userId) {
        List<CatalogItemDetailSnapshot> catalog = catalogLookup.findAllItemDetails();
        ChecklistSnapshot checklist = ChecklistSnapshot.of(checklistLookup.findMyChecklistIfPresent(userId));
        return Set.copyOf(checklist.recommendableItemIds(catalog));
    }

    private Flux<ChatEvent> completeAnswer(ConversationKey key, ReactiveChatAnswerStream stream) {
        ChatAnswer answer = stream.finish();
        List<ChatEvent> events = new ArrayList<>();
        if (!answer.recommendedItemIds().isEmpty()) {
            Set<Long> recommendableIds = loadRecommendableItemIds(key.userId());
            List<Long> suggestedIds = answer.recommendedItemIds().stream()
                    .filter(recommendableIds::contains)
                    .distinct()
                    .toList();
            if (!suggestedIds.isEmpty()) {
                List<Long> ids = checklistLookup.filterRecommendableCatalogItemIds(key.userId(), suggestedIds);
                if (!ids.isEmpty()) {
                    events.add(new ChatEvent.Component(ids));
                }
            }
        }
        return Flux.concat(
                Flux.fromIterable(events),
                Flux.just(new ChatEvent.Done(key.conversationId().toString()))
        );
    }

    private record ActiveRequest(Sinks.Empty<Void> newerRequestArrived, AtomicBoolean replaced) {
    }
}
