package com.bibbidi.wedding.chat.service;

import com.bibbidi.wedding.chat.controller.dto.resp.ChatResponse;
import com.bibbidi.wedding.chat.service.dto.ChatResult;
import com.bibbidi.wedding.chat.sse.service.SseConnection;
import com.bibbidi.wedding.chat.sse.service.dto.ChatEventType;
import com.bibbidi.wedding.chat.sse.service.dto.SseEvent;

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

    public void complete(ChatResult result, Runnable rememberTurn) {
        connection.complete(new SseEvent(ChatEventType.DONE, new ChatResponse.Conversation(result.conversationId())), rememberTurn);
    }
}
