package com.bibbidi.wedding.chat.infra.sse.dto;

public record SseEvent(
        ChatEventType type,
        Object data
) {
}
