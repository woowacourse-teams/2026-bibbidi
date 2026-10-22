package com.bibbidi.wedding.chat.service.port;

import reactor.core.publisher.Flux;

public interface AiConversationPort {

    Flux<String> stream(Long userId, String conversationKey, String userPrompt);

}
