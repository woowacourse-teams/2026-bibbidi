package com.bibbidi.wedding.chat.adapter.ai.routing;

import java.util.List;

public record ModelSelectPlan(List<ChatModelTier> remaining) {

    public static ModelSelectPlan startingAt(ChatModelTier tier) {
        return new ModelSelectPlan(tier.fallbackOrder());
    }

    public ChatModelTier tier() {
        return remaining.getFirst();
    }

    public boolean hasFallback() {
        return remaining.size() > 1;
    }

    public ModelSelectPlan fallback() {
        return new ModelSelectPlan(remaining.subList(1, remaining.size()));
    }
}
