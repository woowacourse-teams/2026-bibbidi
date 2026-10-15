package com.bibbidi.wedding.chat.controller.sse.dto;

import com.bibbidi.wedding.chat.controller.sse.ChatEventType;

public record SseEvent(
        ChatEventType type,
        Object data
) {
}
