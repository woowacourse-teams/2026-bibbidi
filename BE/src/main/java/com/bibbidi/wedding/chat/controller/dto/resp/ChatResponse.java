package com.bibbidi.wedding.chat.controller.dto.resp;

import java.util.List;

public final class ChatResponse {

    public record Conversation(String conversationId) {
    }

    public record Delta(String text) {
    }

    public record Component(List<Long> catalogItemIds) {
    }

    public record Failure(int errorCode, String message) {
    }
}
