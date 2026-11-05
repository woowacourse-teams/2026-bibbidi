package com.bibbidi.wedding.chat.evaluation;

import com.bibbidi.wedding.chat.adapter.ai.BibbidiInMemoryChatMemory;
import com.bibbidi.wedding.chat.evaluation.data.prep.EvaluationScenario;
import com.bibbidi.wedding.chat.evaluation.report.RecordingChatModel;
import com.bibbidi.wedding.chat.service.AiChatService;
import com.bibbidi.wedding.chat.service.ConversationKey;
import com.bibbidi.wedding.chat.service.dto.command.ChatCommand;
import com.bibbidi.wedding.chat.service.dto.prompt.BibbidiCustomChatPromptContext;
import com.bibbidi.wedding.chat.service.dto.result.ChatEvent;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.document.Document;
import tools.jackson.databind.ObjectMapper;

public class EvaluationChatRunner {

    private final AiChatService service;
    private final BibbidiInMemoryChatMemory memory;
    private final RecordingChatModel model;
    private final ObjectMapper mapper;
    private final StringBuilder answer = new StringBuilder();
    private final List<Long> recommendedItemIds = new ArrayList<>();
    private List<Document> providedContext = List.of();
    private boolean completed;

    public EvaluationChatRunner(AiChatService service, BibbidiInMemoryChatMemory memory,
                                RecordingChatModel model, ObjectMapper mapper) {
        this.service = service;
        this.memory = memory;
        this.model = model;
        this.mapper = mapper;
    }

    public void run(EvaluationScenario scenario, Long userId, Duration timeout) {
        UUID conversationId = UUID.randomUUID();
        String memoryKey = new ConversationKey(userId, conversationId).toMemoryKey();
        model.reset();
        answer.setLength(0);
        recommendedItemIds.clear();
        providedContext = List.of();
        completed = false;
        try {
            memory.add(memoryKey, scenario.chatMemory().stream().map(this::message).toList());
            service.chat(new ChatCommand(userId, conversationId, scenario.userMessage()))
                    .doOnNext(this::accept)
                    .blockLast(timeout);
            if (!completed || answer.isEmpty()) {
                throw new IllegalStateException("평가 답변이 정상 완료되지 않았습니다.");
            }
        } finally {
            try {
                BibbidiCustomChatPromptContext context = memory.bibbidiCustomContext(memoryKey);
                if (context != null && !model.calls().isEmpty()) {
                    providedContext = List.of(new Document(mapper.writeValueAsString(context)));
                }
            } finally {
                memory.clear(memoryKey);
            }
        }
    }

    public String answer() {
        return answer.toString();
    }

    public List<Long> recommendedItemIds() {
        return List.copyOf(recommendedItemIds);
    }

    public List<Document> providedContext() {
        return providedContext;
    }

    private void accept(ChatEvent event) {
        switch (event) {
            case ChatEvent.Delta delta -> answer.append(delta.text());
            case ChatEvent.Component component -> recommendedItemIds.addAll(component.catalogItemIds());
            case ChatEvent.Done ignored -> completed = true;
            default -> { }
        }
    }

    private Message message(EvaluationScenario.ChatMessage message) {
        return switch (message.role()) {
            case "user" -> new UserMessage(message.content());
            case "assistant" -> new AssistantMessage(message.content());
            default -> throw new IllegalArgumentException("Unknown chat memory role: " + message.role());
        };
    }
}
