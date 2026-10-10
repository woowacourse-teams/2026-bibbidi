package com.bibbidi.wedding.sse.service.dto;

public record SseEvent(
        String name,
        Object data
) {
}
