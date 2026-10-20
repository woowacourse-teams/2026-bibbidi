package com.bibbidi.wedding.chat.service.dto.result;

import java.util.Set;
import reactor.core.publisher.Flux;

public record AiResponseStream(
        Flux<String> content,
        Set<Long> recommendableItemIds
) {
}
