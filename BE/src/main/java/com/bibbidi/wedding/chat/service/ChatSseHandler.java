package com.bibbidi.wedding.chat.service;

import com.bibbidi.wedding.chat.controller.dto.resp.ChatResponse;
import com.bibbidi.wedding.chat.service.dto.ChatResult;
import com.bibbidi.wedding.chat.sse.service.SseConnection;
import com.bibbidi.wedding.chat.sse.service.dto.SseEvent;

public final class ChatSseHandler {

    private static final String CONVERSATION_EVENT = "conversation";
    private static final String DELTA_EVENT = "delta";
    private static final String DONE_EVENT = "done";

    private final SseConnection connection;

    public ChatSseHandler(SseConnection connection) {
        this.connection = connection;
    }

    public void conversation(String conversationId) {
        connection.send(new SseEvent(CONVERSATION_EVENT, new ChatResponse.Conversation(conversationId)));
    }

    public void sendAnswerChunk(String text) {
        connection.send(new SseEvent(DELTA_EVENT, new ChatResponse.Delta(text)));
    }

    public void complete(ChatResult result, Runnable rememberTurn) {
        connection.complete(new SseEvent(DONE_EVENT, new ChatResponse.Conversation(result.conversationId())), rememberTurn);
    }
}
