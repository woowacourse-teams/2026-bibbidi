package com.bibbidi.wedding.chat.evaluation.data.prep;

import java.util.List;

public record EvaluationScenario(
        String name,
        List<String> metrics,
        String userMessage,
        List<ChatMessage> chatMemory,
        List<ExpectedToolCall> expectedToolCalls,
        String referenceAnswer,
        String expectedRefusal
) {

    public record ChatMessage(String role, String content) {
    }

    public record ExpectedToolCall(String name, ToolArguments arguments) {
    }

    public record ToolArguments() {
    }
}
