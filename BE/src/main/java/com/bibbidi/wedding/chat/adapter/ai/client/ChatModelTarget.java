package com.bibbidi.wedding.chat.adapter.ai.client;

import java.util.function.Supplier;
import org.jspecify.annotations.Nullable;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.prompt.ChatOptions;

public record ChatModelTarget(
        ChatClient client,
        String modelName,
        @Nullable Supplier<ChatOptions.Builder<?>> options
) {
}
