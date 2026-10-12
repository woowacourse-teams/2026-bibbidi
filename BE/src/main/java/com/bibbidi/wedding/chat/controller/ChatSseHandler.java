package com.bibbidi.wedding.chat.controller;

import com.bibbidi.wedding.chat.controller.dto.resp.ChatResponse;
import com.bibbidi.wedding.chat.service.ChatReplyHandler;
import com.bibbidi.wedding.chat.service.dto.ChatResult;
import com.bibbidi.wedding.sse.service.SseConnection;
import com.bibbidi.wedding.sse.service.dto.SseEvent;

final class ChatSseHandler implements ChatReplyHandler {

    private static final String CONVERSATION_EVENT = "conversation";
    private static final String DELTA_EVENT = "delta";
    private static final String DONE_EVENT = "done";

    private final SseConnection connection;

    ChatSseHandler(SseConnection connection) {
        this.connection = connection;
    }

    @Override
    public void conversation(String conversationId) {
        connection.send(new SseEvent(CONVERSATION_EVENT, new ChatResponse.Conversation(conversationId)));
    }

    @Override
    public void sendAnswerChunk(String text) {
        connection.send(new SseEvent(DELTA_EVENT, new ChatResponse.Delta(text)));
    }

    @Override
    public void complete(ChatResult result, Runnable rememberTurn) {
        connection.complete(new SseEvent(DONE_EVENT, new ChatResponse.Conversation(result.conversationId())), rememberTurn);
    }
}
