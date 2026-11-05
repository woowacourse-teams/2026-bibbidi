package com.bibbidi.wedding.chat.evaluation.data.prep;

import java.util.List;

public record EvaluationScenario(
        String name,
        List<String> metrics,
        String userMessage,
        List<ChatMessage> chatMemory,
        String referenceAnswer,
        String expectedRefusal
) {

    public record ChatMessage(String role, String content) {
    }
}
