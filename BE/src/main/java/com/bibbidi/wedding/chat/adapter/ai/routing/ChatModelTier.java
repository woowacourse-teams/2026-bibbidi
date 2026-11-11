package com.bibbidi.wedding.chat.adapter.ai.routing;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

public enum ChatModelTier {
    LOW,
    MEDIUM,
    HIGH;

    public ChatModelTier higher() {
        return values()[Math.min(ordinal() + 1, HIGH.ordinal())];
    }

    public List<ChatModelTier> fallbackOrder() {
        return switch (this) {
            case LOW -> List.of(LOW, MEDIUM, HIGH);
            case MEDIUM -> List.of(MEDIUM, HIGH, LOW);
            case HIGH -> List.of(HIGH, MEDIUM, LOW);
        };
    }

    public static Optional<ChatModelTier> fromChoice(String choice) {
        return Arrays.stream(values())
                .filter(tier -> tier.name().equalsIgnoreCase(choice))
                .findFirst();
    }
}
