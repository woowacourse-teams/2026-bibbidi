package com.bibbidi.wedding.chat.controller.sse;

import com.bibbidi.wedding.chat.controller.dto.resp.ChatResponse;
import com.bibbidi.wedding.chat.controller.sse.dto.SseEvent;
import com.bibbidi.wedding.chat.service.dto.result.ChatEvent;

public final class ChatSseHandler {

    private final SseConnection connection;

    public ChatSseHandler(SseConnection connection) {
        this.connection = connection;
    }

    public void send(ChatEvent event) {
        if (event instanceof ChatEvent.Conversation conversation) {
            connection.send(
                    new SseEvent(
                            ChatEventType.CONVERSATION,
                            new ChatResponse.Conversation(conversation.conversationId())
                    )
            );
        } else if (event instanceof ChatEvent.Delta delta) {
            connection.send(
                    new SseEvent(
                            ChatEventType.DELTA,
                            new ChatResponse.Delta(delta.text())
                    )
            );
        } else if (event instanceof ChatEvent.Component component) {
            connection.send(
                    new SseEvent(
                            ChatEventType.COMPONENT,
                            new ChatResponse.Component(component.catalogItemIds())
                    )
            );
        } else if (event instanceof ChatEvent.Done done) {
            connection.send(new SseEvent(
                            ChatEventType.DONE,
                            new ChatResponse.Conversation(done.conversationId())
                    )
            );
        }
    }
}
