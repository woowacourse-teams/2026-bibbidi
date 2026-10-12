package com.bibbidi.wedding.chat.controller.dto.resp;

public final class ChatResponse {

    public record Conversation(String conversationId) {
    }

    public record Delta(String text) {
    }

    public record Failure(String message) {
    }
}
