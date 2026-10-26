package com.bibbidi.wedding.chat.adapter.ai.routing;

import java.util.Map;
import java.util.Optional;

public enum ChatModelTier {
    QWEN {
        @Override
        public ChatModelTier higher() {
            return LUNA;
        }
    },
    LUNA {
        @Override
        public ChatModelTier higher() {
            return SOL;
        }
    },
    SOL {
        @Override
        public ChatModelTier higher() {
            return SOL;
        }
    };

    private static final Map<String, ChatModelTier> BY_CHOICE = Map.of(
            "qwen", QWEN,
            "luna", LUNA,
            "sol", SOL
    );

    public abstract ChatModelTier higher();

    public static Optional<ChatModelTier> fromChoice(String choice) {
        return Optional.ofNullable(BY_CHOICE.get(choice));
    }
}
