package com.bibbidi.wedding.chat.adapter.ai.routing;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public enum ChatModelTier {
    QWEN {
        @Override
        public ChatModelTier higher() {
            return LUNA;
        }

        @Override
        public ChatModelTier lower() {
            return QWEN;
        }
    },
    LUNA {
        @Override
        public ChatModelTier higher() {
            return SOL;
        }

        @Override
        public ChatModelTier lower() {
            return QWEN;
        }
    },
    SOL {
        @Override
        public ChatModelTier higher() {
            return SOL;
        }

        @Override
        public ChatModelTier lower() {
            return LUNA;
        }
    };

    private static final int MAX_RETRIES = 3;

    private static final Map<String, ChatModelTier> BY_CHOICE = Map.of(
            "qwen", QWEN,
            "luna", LUNA,
            "sol", SOL
    );

    public abstract ChatModelTier higher();

    public abstract ChatModelTier lower();

    public List<ChatModelTier> fallbackOrder() {
        List<ChatModelTier> order = new ArrayList<>();
        ChatModelTier current = this;
        boolean descending = current == SOL;
        for (int attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            order.add(current);
            if (current == SOL) {
                descending = true;
            }
            ChatModelTier next = descending ? current.lower() : current.higher();
            if (next == current) {
                break;
            }
            current = next;
        }
        return List.copyOf(order);
    }

    public static Optional<ChatModelTier> fromChoice(String choice) {
        return Optional.ofNullable(BY_CHOICE.get(choice));
    }
}
