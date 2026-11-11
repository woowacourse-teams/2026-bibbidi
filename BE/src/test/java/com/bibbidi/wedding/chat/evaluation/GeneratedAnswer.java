package com.bibbidi.wedding.chat.evaluation;

import com.bibbidi.wedding.chat.service.dto.result.ChatResult;
import java.util.ArrayList;
import java.util.List;

class GeneratedAnswer {

    private final StringBuilder answer = new StringBuilder();
    private final List<Long> recommendedItemIds = new ArrayList<>();
    private boolean done;

    void accept(ChatResult result) {
        switch (result) {
            case ChatResult.Delta delta -> answer.append(delta.text());
            case ChatResult.Answer completed -> recommendedItemIds.addAll(completed.recommendedItemIds());
            case ChatResult.Completed ignored -> done = true;
            case ChatResult.Failed failed ->
                    throw new IllegalStateException("실패 사건은 오류로 전달되어야 합니다.", failed.cause());
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
