package com.bibbidi.wedding.chat.service.port;

import com.bibbidi.wedding.chat.service.dto.result.ChatResult;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface AiConversationPort {

    Flux<ChatResult> stream(Long userId, String conversationKey, String userPrompt);

    default Mono<Void> restoreContext(String conversationKey) {
        return Mono.empty();
    }
}
