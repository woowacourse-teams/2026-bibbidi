package com.bibbidi.wedding.chat.service;

import com.bibbidi.wedding.chat.controller.dto.resp.ChatResponse;
import com.bibbidi.wedding.chat.infra.sse.SseConnection;
import com.bibbidi.wedding.chat.infra.sse.dto.ChatEventType;
import com.bibbidi.wedding.chat.infra.sse.dto.SseEvent;
import com.bibbidi.wedding.chat.service.dto.ChatResult;
import java.util.List;

public final class ChatSseHandler {

    private final SseConnection connection;

    public ChatSseHandler(SseConnection connection) {
        this.connection = connection;
    }

    public void conversation(String conversationId) {
        connection.send(new SseEvent(ChatEventType.CONVERSATION, new ChatResponse.Conversation(conversationId)));
    }

    public void sendAnswerChunk(String text) {
        connection.send(new SseEvent(ChatEventType.DELTA, new ChatResponse.Delta(text)));
    }

    public void sendComponent(List<Long> catalogItemIds) {
        connection.send(new SseEvent(ChatEventType.COMPONENT, new ChatResponse.Component(catalogItemIds)));
    }

    public void complete(ChatResult result, Runnable rememberTurn) {
        connection.complete(new SseEvent(ChatEventType.DONE, new ChatResponse.Conversation(result.conversationId())), rememberTurn);
    }
}
