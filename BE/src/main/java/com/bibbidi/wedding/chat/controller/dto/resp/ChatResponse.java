package com.bibbidi.wedding.chat.controller.dto.resp;

public final class ChatResponse {

    private ChatResponse() {
    }

    public record Conversation(String conversationId) {
    }

    public record Delta(String text) {
    }

    public record Failure(String message) {
    }
}
