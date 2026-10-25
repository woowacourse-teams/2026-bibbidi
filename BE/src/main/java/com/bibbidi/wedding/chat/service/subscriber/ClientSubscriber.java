package com.bibbidi.wedding.chat.service.subscriber;

import com.bibbidi.wedding.chat.service.dto.result.ChatResult;
import com.bibbidi.wedding.chat.service.turn.TurnContext;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.scheduler.Schedulers;

@Component
public final class ClientSubscriber implements TurnSubscriber {

    @Override
    public Flux<ChatResult> subscribe(TurnContext context, Flux<ChatResult> results) {
        return results
                .publishOn(Schedulers.boundedElastic())
                .concatMap(this::toClient);
    }

    private Flux<ChatResult> toClient(ChatResult result) {
        return switch (result) {
            case ChatResult.Failed failed -> Flux.error(failed.cause());
            case ChatResult.Selected ignored -> Flux.empty();
            case ChatResult.Cancelled ignored -> Flux.empty();
            default -> Flux.just(result);
        };
    }
}
