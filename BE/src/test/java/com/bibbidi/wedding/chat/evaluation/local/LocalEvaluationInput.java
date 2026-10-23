package com.bibbidi.wedding.chat.evaluation.local;

import com.bibbidi.wedding.chat.evaluation.data.prep.EvaluationScenario;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.document.Document;

public record LocalEvaluationInput(
        String systemPrompt,
        List<String> providedContext,
        List<EvaluationScenario> scenarios
) {

    public LocalEvaluationInput {
        if (systemPrompt == null || systemPrompt.isBlank()
                || providedContext == null || scenarios == null || scenarios.isEmpty()) {
            throw new IllegalArgumentException("systemPrompt, providedContext and scenarios are required");
        }
        providedContext = List.copyOf(providedContext);
        scenarios = List.copyOf(scenarios);
    }

    void validateScenarios(Set<String> knownMetrics) {
        for (EvaluationScenario scenario : scenarios) {
            if (scenario.userMessage() == null || scenario.chatMemory() == null
                    || scenario.metrics() == null || scenario.metrics().isEmpty()
                    || !knownMetrics.containsAll(scenario.metrics())) {
                throw new IllegalArgumentException("Invalid scenario or unknown metrics: " + scenario.name());
            }
        }
    }

    List<Document> evaluationContext() {
        List<Document> context = new ArrayList<>();
        context.add(new Document(systemPrompt));
        for (String information : providedContext) {
            context.add(new Document(information));
        }
        return List.copyOf(context);
    }

    Prompt promptFor(EvaluationScenario scenario) {
        List<Message> messages = new ArrayList<>();
        messages.add(new SystemMessage(systemPrompt));
        addProvidedContext(messages);
        addChatMemory(messages, scenario.chatMemory());
        messages.add(new UserMessage(scenario.userMessage()));
        return new Prompt(messages);
    }

    private void addProvidedContext(List<Message> messages) {
        if (!providedContext.isEmpty()) {
            messages.add(new SystemMessage(String.join("\n\n", providedContext)));
        }
    }

    private void addChatMemory(List<Message> messages, List<EvaluationScenario.ChatMessage> memory) {
        for (EvaluationScenario.ChatMessage message : memory) {
            messages.add(switch (message.role()) {
                case "user" -> new UserMessage(message.content());
                case "assistant" -> new AssistantMessage(message.content());
                default -> throw new IllegalArgumentException("Unknown chat memory role: " + message.role());
            });
        }
    }
}
