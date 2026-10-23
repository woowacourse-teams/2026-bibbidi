package com.bibbidi.wedding.chat.service.port;

import reactor.core.publisher.Flux;

public interface AiConversationPort {

    String modelName();

    Flux<AiResponse> stream(Long userId, String conversationKey, String userPrompt);

}
