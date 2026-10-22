package com.bibbidi.wedding.chat.service;

import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.chat.service.dto.command.ChatCommand;
import com.bibbidi.wedding.chat.service.dto.prompt.ChecklistSnapshot;
import com.bibbidi.wedding.chat.service.dto.result.ChatAnswer;
import com.bibbidi.wedding.chat.service.dto.result.ChatEvent;
import com.bibbidi.wedding.chat.service.port.AiConversationPort;
import com.bibbidi.wedding.chat.service.port.CatalogLookupPort;
import com.bibbidi.wedding.chat.service.port.ChatAnswerParser;
import com.bibbidi.wedding.chat.service.port.ChecklistLookupPort;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;
import reactor.core.scheduler.Schedulers;

@Service
public class AiChatService {

    private final AiConversationPort conversationPort;
    private final CatalogLookupPort catalogLookup;
    private final ChecklistLookupPort checklistLookup;
    private final ChatAnswerParser answerParser;
    private final Map<ConversationKey, Sinks.Empty<Void>> activeConversations = new ConcurrentHashMap<>();

    public AiChatService(
            AiConversationPort conversationPort,
            CatalogLookupPort catalogLookup,
            ChecklistLookupPort checklistLookup,
            ChatAnswerParser answerParser
    ) {
        this.conversationPort = conversationPort;
        this.catalogLookup = catalogLookup;
        this.checklistLookup = checklistLookup;
        this.answerParser = answerParser;
    }

    public Flux<ChatEvent> chat(ChatCommand chatCommand) {
        UUID id = chatCommand.conversationId() == null ? UUID.randomUUID() : chatCommand.conversationId();
        ConversationKey key = new ConversationKey(chatCommand.userId(), id);
        return Flux.defer(() -> {
                    Sinks.Empty<Void> superseded = Sinks.empty();
                    Sinks.Empty<Void> previous = activeConversations.put(key, superseded);
                    if (previous != null) {
                        previous.tryEmitEmpty();
                    }

                    return Flux.concat(
                                    Flux.just(new ChatEvent.Conversation(id.toString())),
                                    Flux.defer(() -> streamAnswer(key, id, chatCommand.message()))
                            )
                            .subscribeOn(Schedulers.boundedElastic())
                            .takeUntilOther(superseded.asMono())
                            .doFinally(ignored -> activeConversations.remove(key, superseded));
                }
        );
    }

    private Flux<ChatEvent> streamAnswer(ConversationKey key, UUID id, String message) {
        Flux<String> response = conversationPort.stream(key.userId(), key.toMemoryKey(), message);
        List<String> deltas = new ArrayList<>();
        ChatAnswerParser.Session answer = answerParser.newSession(deltas::add);

        Flux<ChatEvent> answerEvents = response
                .publishOn(Schedulers.boundedElastic())
                .concatMap(chunk -> {
                            deltas.clear();
                            answer.accept(chunk);
                            List<ChatEvent> events = new ArrayList<>();
                            for (String delta : deltas) {
                                events.add(new ChatEvent.Delta(delta));
                            }
                            return Flux.fromIterable(events);
                        }
                );

        Flux<ChatEvent> completion = Flux.defer(() -> completeAnswer(key, id, answer));
        return Flux.concat(answerEvents, completion);
    }

    private Set<Long> loadRecommendableItemIds(Long userId) {
        List<CatalogItemDetailSnapshot> catalog = catalogLookup.findAllItemDetails();
        ChecklistSnapshot checklist = ChecklistSnapshot.of(checklistLookup.findMyChecklistIfPresent(userId));
        return Set.copyOf(checklist.recommendableItemIds(catalog));
    }

    private Flux<ChatEvent> completeAnswer(ConversationKey key, UUID id, ChatAnswerParser.Session stream) {
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
                Flux.just(new ChatEvent.Done(id.toString()))
        );
    }
}
