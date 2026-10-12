package com.bibbidi.wedding.chat.sse.service.dto;

public record SseEvent(
        ChatEventType type,
        Object data
) {
}
