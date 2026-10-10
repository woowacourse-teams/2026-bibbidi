package com.bibbidi.wedding.chat.service;

import com.bibbidi.wedding.chat.service.dto.ChatResult;

public interface ChatReplyHandler {

    void conversation(String conversationId);

    void sendAnswerChunk(String text);

    void complete(ChatResult result, Runnable rememberTurn);
}
