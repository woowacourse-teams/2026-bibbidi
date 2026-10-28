package com.bibbidi.wedding.balancegame.adapter.ai.prompt;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

@Component
public class BalanceGameSystemPrompt {

    private static final String RESOURCE_PATH = "prompts/balance-game-system.txt";
    private static final String LOAD_FAILURE_MESSAGE = "밸런스게임 시스템 프롬프트를 읽을 수 없습니다: ";

    private final String text;

    public BalanceGameSystemPrompt() {
        this.text = load();
    }

    public String text() {
        return text;
    }

    private static String load() {
        try {
            return new ClassPathResource(RESOURCE_PATH).getContentAsString(StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(LOAD_FAILURE_MESSAGE + RESOURCE_PATH, e);
        }
    }
}
