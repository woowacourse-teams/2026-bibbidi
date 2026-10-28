package com.bibbidi.wedding.balancegame.adapter.ai.client;

import java.util.function.Function;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.prompt.ChatOptions;

public record BalanceGameModelTarget(
        ChatClient client,
        Function<String, ChatOptions.Builder<?>> optionsWithSchema
) {
}
