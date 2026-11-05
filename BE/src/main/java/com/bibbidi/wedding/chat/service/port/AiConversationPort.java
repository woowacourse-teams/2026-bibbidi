package com.bibbidi.wedding.chat.service.port;

import com.bibbidi.wedding.chat.service.dto.result.AiResponseStream;
import com.bibbidi.wedding.chat.service.dto.prompt.BibbidiCustomChatPromptContext;

public interface AiConversationPort {

    AiResponseStream stream(String conversationKey, String userPrompt, BibbidiCustomChatPromptContext context);

    void remember(String conversationKey, String userPrompt, String answer);
}
