package com.bibbidi.wedding.chat.service.dto.result;

import java.util.List;

public sealed interface ChatEvent {

    record Conversation(String conversationId) implements ChatEvent {
    }

    record Delta(String text) implements ChatEvent {
    }

    record Component(List<Long> catalogItemIds) implements ChatEvent {
    }

    record Done(String conversationId) implements ChatEvent {
    }
}
