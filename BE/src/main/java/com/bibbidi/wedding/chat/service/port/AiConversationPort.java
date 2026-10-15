package com.bibbidi.wedding.chat.service.port;

import com.bibbidi.wedding.chat.service.dto.AiResponseStream;
import com.bibbidi.wedding.chat.service.dto.ChatPromptContext;

public interface AiConversationPort {

    AiResponseStream stream(String conversationKey, String message, ChatPromptContext context);

    void remember(String conversationKey, String message, String answer);
}
