package com.bibbidi.wedding.chat.service.turn;

import reactor.core.publisher.Flux;

public interface TurnConsumer {

    void consume(TurnContext context, Flux<TurnSignal> signals);
}
