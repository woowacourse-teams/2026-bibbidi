package com.bibbidi.wedding.chat.service.subscriber;

import com.bibbidi.wedding.chat.service.dto.result.ChatResult;
import com.bibbidi.wedding.chat.service.turn.TurnContext;
import reactor.core.publisher.Flux;

public interface TurnSubscriber {

    Flux<ChatResult> subscribe(TurnContext context, Flux<ChatResult> results);
}
