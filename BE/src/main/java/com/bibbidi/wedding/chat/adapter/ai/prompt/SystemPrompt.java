package com.bibbidi.wedding.chat.adapter.ai.prompt;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

@Component
public class SystemPrompt {

    private static final String RESOURCE_PATH = "prompts/ai-chat-system.txt";

    private final String text;

    public SystemPrompt() {
        this.text = load();
    }

    public String text() {
        return text;
    }

    private static String load() {
        try {
            return new ClassPathResource(RESOURCE_PATH).getContentAsString(StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("시스템 프롬프트를 읽을 수 없습니다: " + RESOURCE_PATH, e);
        }
    }
}
