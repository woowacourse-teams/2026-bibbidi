package com.bibbidi.wedding.chat.controller;

import com.bibbidi.wedding.chat.controller.dto.resp.ChatResponse;
import com.bibbidi.wedding.chat.service.ChatReplyHandler;
import com.bibbidi.wedding.chat.service.dto.ChatResult;
import com.bibbidi.wedding.sse.service.SseConnection;
import com.bibbidi.wedding.sse.service.dto.SseEvent;

final class ChatSseHandler implements ChatReplyHandler {

    private final SseConnection connection;

    ChatSseHandler(SseConnection connection) {
        this.connection = connection;
    }

    @Override
    public void conversation(String conversationId) {
        connection.send(new SseEvent("conversation", new ChatResponse.Conversation(conversationId)));
    }

    @Override
    public void delta(String text) {
        connection.send(new SseEvent("delta", new ChatResponse.Delta(text)));
    }

    @Override
    public void complete(ChatResult result, Runnable remember) {
        connection.complete(new SseEvent("done", new ChatResponse.Conversation(result.conversationId())), remember);
    }
}
