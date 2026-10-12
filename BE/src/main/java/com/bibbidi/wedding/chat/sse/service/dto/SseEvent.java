package com.bibbidi.wedding.chat.sse.service.dto;

public record SseEvent(
        String name,
        Object data
) {
}
