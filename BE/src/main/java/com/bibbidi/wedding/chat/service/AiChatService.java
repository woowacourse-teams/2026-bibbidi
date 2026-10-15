package com.bibbidi.wedding.chat.service;

import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.chat.service.dto.command.ChatCommand;
import com.bibbidi.wedding.chat.service.dto.prompt.BibbidiCustomChatPromptContext;
import com.bibbidi.wedding.chat.service.dto.prompt.ChecklistSnapshot;
import com.bibbidi.wedding.chat.service.dto.result.AiResponseStream;
import com.bibbidi.wedding.chat.service.dto.result.ChatAnswer;
import com.bibbidi.wedding.chat.service.dto.result.ChatEvent;
import com.bibbidi.wedding.chat.service.port.AiConversationPort;
import com.bibbidi.wedding.chat.service.port.CatalogLookupPort;
import com.bibbidi.wedding.chat.service.port.ChatAnswerParser;
import com.bibbidi.wedding.chat.service.port.ChecklistLookupPort;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;
import reactor.core.scheduler.Schedulers;

@Service
@Slf4j
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
                    AtomicReference<Runnable> recordPartialTurn = new AtomicReference<>(() -> { });
                    Sinks.Empty<Void> previous = activeConversations.put(key, superseded);
                    if (previous != null) {
                        previous.tryEmitEmpty();
                    }

                    return Flux.concat(
                                    Flux.just(new ChatEvent.Conversation(id.toString())),
                                    Flux.defer(() -> streamAnswer(key, id, chatCommand.message(), recordPartialTurn))
                            )
                            .subscribeOn(Schedulers.boundedElastic())
                            .takeUntilOther(superseded.asMono()
                                    .doOnSuccess(ignored -> recordPartialTurn.get().run()))
                            .doFinally(ignored -> activeConversations.remove(key, superseded));
                }
        );
    }

    private Flux<ChatEvent> streamAnswer(ConversationKey key, UUID id, String message,
                                         AtomicReference<Runnable> recordPartialTurn) {
        BibbidiCustomChatPromptContext context = loadPromptContext(key.userId());
        AiResponseStream response = conversationPort.stream(key.toMemoryKey(), message, context);
        List<String> deltas = new ArrayList<>();
        ChatAnswerParser.Session answer = answerParser.newSession(deltas::add);
        StringBuffer streamed = new StringBuffer();
        AtomicBoolean remembered = new AtomicBoolean();

        Flux<ChatEvent> answerEvents = response.content()
                .publishOn(Schedulers.boundedElastic())
                .concatMap(chunk -> {
                            deltas.clear();
                            answer.accept(chunk);
                            List<ChatEvent> events = new ArrayList<>();
                            for (String delta : deltas) {
                                streamed.append(delta);
                                events.add(new ChatEvent.Delta(delta));
                            }
                            return Flux.fromIterable(events);
                        }
                );

        Flux<ChatEvent> completion = Flux.defer(() -> completeAnswer(key, id, message,
                response.recommendableItemIds(), answer, remembered));
        recordPartialTurn.set(() -> {
            if (!streamed.isEmpty() && remembered.compareAndSet(false, true)) {
                rememberTurn(key, message, streamed.toString());
            }
        });
        return Flux.concat(answerEvents, completion);
    }

    private BibbidiCustomChatPromptContext loadPromptContext(Long userId) {
        List<CatalogItemDetailSnapshot> catalog = catalogLookup.findAllItemDetails();
        ChecklistSnapshot checklist = checklistLookup.findMyChecklistIfPresent(userId)
                .map(ChecklistSnapshot::from)
                .orElseGet(ChecklistSnapshot::notFound);

        Set<Long> addedIds = new HashSet<>();
        checklist.items().forEach(item -> addedIds.add(item.catalogItemId()));

        Set<Long> recommendableIds = new HashSet<>();
        catalog.forEach(item -> {
                    if (!addedIds.contains(item.id())) {
                        recommendableIds.add(item.id());
                    }
                }
        );

        return new BibbidiCustomChatPromptContext(checklist, catalog, recommendableIds);
    }

    private Flux<ChatEvent> completeAnswer(ConversationKey key, UUID id, String message,
                                           Set<Long> recommendableIds, ChatAnswerParser.Session stream,
                                           AtomicBoolean remembered) {
        ChatAnswer answer = stream.finish();
        List<Long> suggestedIds = answer.recommendedItemIds().stream()
                .filter(recommendableIds::contains)
                .distinct()
                .toList();
        List<ChatEvent> events = new ArrayList<>();
        if (!suggestedIds.isEmpty()) {
            List<Long> ids = checklistLookup.filterRecommendableCatalogItemIds(key.userId(), suggestedIds);
            if (!ids.isEmpty()) {
                events.add(new ChatEvent.Component(ids));
            }
        }
        return Flux.concat(
                Flux.fromIterable(events),
                Flux.just(new ChatEvent.Done(id.toString())),
                Mono.fromRunnable(() -> {
                                    if (remembered.compareAndSet(false, true)) {
                                        rememberTurn(key, message, answer.answer());
                                    }
                                }
                        )
                        .then(Mono.empty())
        );
    }

    private void rememberTurn(ConversationKey key, String message, String answer) {
        try {
            conversationPort.remember(key.toMemoryKey(), message, answer);
        } catch (RuntimeException exception) {
            log.error("AI 대화 저장 실패", exception);
        }
    }
}
