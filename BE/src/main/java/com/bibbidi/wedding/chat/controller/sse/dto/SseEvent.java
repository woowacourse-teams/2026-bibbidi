package com.bibbidi.wedding.chat.controller.sse.dto;

public record SseEvent(
        ChatEventType type,
        Object data
) {
}
