package com.bibbidi.wedding.chat.service;

import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.chat.service.dto.AiResponseStream;
import com.bibbidi.wedding.chat.service.dto.ChatAnswer;
import com.bibbidi.wedding.chat.service.dto.ChatEvent;
import com.bibbidi.wedding.chat.service.dto.ChatPromptContext;
import com.bibbidi.wedding.chat.service.dto.ChecklistSnapshot;
import com.bibbidi.wedding.chat.service.port.AiConversationPort;
import com.bibbidi.wedding.chat.service.port.ChatAnswerParser;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

@Service
@Slf4j
public class AiChatService {

    private final AiConversationPort conversationPort;
    private final CatalogService catalogService;
    private final ChecklistService checklistService;
    private final ChatAnswerParser answerParser;
    private final Set<ConversationKey> activeConversations = ConcurrentHashMap.newKeySet();

    public AiChatService(
            AiConversationPort conversationPort,
            CatalogService catalogService,
            ChecklistService checklistService,
            ChatAnswerParser answerParser
    ) {
        this.conversationPort = conversationPort;
        this.catalogService = catalogService;
        this.checklistService = checklistService;
        this.answerParser = answerParser;
    }

    public Flux<ChatEvent> chat(Long userId, @Nullable UUID conversationId, String message) {
        UUID id = conversationId == null ? UUID.randomUUID() : conversationId;
        ConversationKey key = new ConversationKey(userId, id);
        return Flux.defer(() -> {
            if (!activeConversations.add(key)) {
                return Flux.error(new BusinessException(ClientError.INTERNAL_ERROR, "같은 대화의 응답이 이미 진행 중입니다."));
            }
            return Flux.concat(
                            Flux.just(new ChatEvent.Conversation(id.toString())),
                            Flux.defer(() -> streamAnswer(key, id, message)))
                    .subscribeOn(Schedulers.boundedElastic())
                    .doFinally(ignored -> activeConversations.remove(key));
        });
    }

    private Flux<ChatEvent> streamAnswer(ConversationKey key, UUID id, String message) {
        ChatPromptContext context = loadPromptContext(key.userId());
        AiResponseStream response = conversationPort.stream(key.toMemoryKey(), message, context);
        List<String> deltas = new ArrayList<>();
        ChatAnswerParser.Session answer = answerParser.newSession(deltas::add);

        Flux<ChatEvent> answerEvents = response.content()
                .publishOn(Schedulers.boundedElastic())
                .concatMap(chunk -> {
                    deltas.clear();
                    answer.accept(chunk);
                    List<ChatEvent> events = new ArrayList<>();
                    for (String delta : deltas) {
                        events.add(new ChatEvent.Delta(delta));
                    }
                    return Flux.fromIterable(events);
                });
        Flux<ChatEvent> completion = Flux.defer(() -> completeAnswer(key, id, message,
                response.recommendableItemIds(), answer));
        return Flux.concat(answerEvents, completion);
    }

    private ChatPromptContext loadPromptContext(Long userId) {
        List<CatalogItemDetailSnapshot> catalog = catalogService.findAllItemDetails();
        ChecklistSnapshot checklist = checklistService.findMyChecklistIfPresent(userId)
                .map(ChecklistSnapshot::from).orElseGet(ChecklistSnapshot::notFound);
        Set<Long> addedIds = new HashSet<>();
        checklist.items().forEach(item -> addedIds.add(item.catalogItemId()));
        Set<Long> recommendableIds = new HashSet<>();
        catalog.forEach(item -> {
            if (!addedIds.contains(item.id())) {
                recommendableIds.add(item.id());
            }
        });
        return new ChatPromptContext(checklist, catalog, recommendableIds);
    }

    private Flux<ChatEvent> completeAnswer(ConversationKey key, UUID id, String message,
                                           Set<Long> recommendableIds, ChatAnswerParser.Session stream) {
        ChatAnswer answer = stream.finish();
        List<Long> suggestedIds = answer.recommendedItemIds().stream()
                .filter(recommendableIds::contains)
                .distinct()
                .toList();
        List<ChatEvent> events = new ArrayList<>();
        if (!suggestedIds.isEmpty()) {
            List<Long> ids = checklistService.filterRecommendableCatalogItemIds(key.userId(), suggestedIds);
            if (!ids.isEmpty()) {
                events.add(new ChatEvent.Component(ids));
            }
        }
        return Flux.concat(
                Flux.fromIterable(events),
                Flux.just(new ChatEvent.Done(id.toString())),
                Mono.fromRunnable(() -> rememberTurn(key, message, answer.answer()))
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
