package com.bibbidi.wedding.chat.service.port;

import com.bibbidi.wedding.chat.service.dto.result.ChatResult;
import reactor.core.publisher.Flux;

public interface AiConversationPort {

    Flux<ChatResult> stream(Long userId, String conversationKey, String userPrompt);

}
