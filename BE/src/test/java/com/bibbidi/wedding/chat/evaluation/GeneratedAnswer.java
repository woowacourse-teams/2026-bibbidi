package com.bibbidi.wedding.chat.evaluation;

import com.bibbidi.wedding.chat.service.dto.ChatEvent;
import java.util.ArrayList;
import java.util.List;

class GeneratedAnswer {

    private final StringBuilder answer = new StringBuilder();
    private final List<Long> recommendedItemIds = new ArrayList<>();
    private boolean done;

    void accept(ChatEvent event) {
        switch (event) {
            case ChatEvent.Delta delta -> answer.append(delta.text());
            case ChatEvent.Component component -> recommendedItemIds.addAll(component.catalogItemIds());
            case ChatEvent.Done ignored -> done = true;
            default -> {
            }
        }
    }

    boolean isComplete() {
        return done && !answer.isEmpty();
    }

    String answer() {
        return answer.toString();
    }

    List<Long> recommendedItemIds() {
        return List.copyOf(recommendedItemIds);
    }
}
