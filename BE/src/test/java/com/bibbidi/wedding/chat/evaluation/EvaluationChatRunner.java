package com.bibbidi.wedding.chat.evaluation;

import com.bibbidi.wedding.chat.evaluation.data.prep.EvaluationScenario;
import com.bibbidi.wedding.chat.evaluation.report.RecordingChatModel;
import com.bibbidi.wedding.chat.service.AiChatService;
import com.bibbidi.wedding.chat.service.ConversationKey;
import com.bibbidi.wedding.chat.service.dto.command.ChatCommand;
import com.bibbidi.wedding.chat.service.dto.result.ChatEvent;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.ToolResponseMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.document.Document;

public class EvaluationChatRunner {

    private final AiChatService service;
    private final ChatMemory memory;
    private final RecordingChatModel model;
    private final StringBuilder answer = new StringBuilder();
    private final List<Long> recommendedItemIds = new ArrayList<>();
    private boolean completed;

    public EvaluationChatRunner(AiChatService service, ChatMemory memory, RecordingChatModel model) {
        this.service = service;
        this.memory = memory;
        this.model = model;
    }

    public void run(EvaluationScenario scenario, Long userId, Duration timeout) {
        UUID conversationId = UUID.randomUUID();
        String memoryKey = new ConversationKey(userId, conversationId).toMemoryKey();
        model.reset();
        answer.setLength(0);
        recommendedItemIds.clear();
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
            memory.clear(memoryKey);
        }
    }

    public String answer() {
        return answer.toString();
    }

    public List<Long> recommendedItemIds() {
        return List.copyOf(recommendedItemIds);
    }

    public List<Document> providedContext() {
        return model.calls().stream()
                .flatMap(call -> call.prompt().getInstructions().stream())
                .filter(ToolResponseMessage.class::isInstance)
                .map(ToolResponseMessage.class::cast)
                .flatMap(message -> message.getResponses().stream())
                .map(ToolResponseMessage.ToolResponse::responseData)
                .distinct()
                .map(Document::new)
                .toList();
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
