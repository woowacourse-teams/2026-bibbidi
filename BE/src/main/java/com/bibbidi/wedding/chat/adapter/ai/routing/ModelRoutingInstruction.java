package com.bibbidi.wedding.chat.adapter.ai.routing;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

@Component
public class ModelRoutingInstruction {

    private static final String RESOURCE_PATH = "prompts/model-routing/instructions.txt";

    private final String text;

    public ModelRoutingInstruction() {
        this.text = load();
    }

    public String text() {
        return text;
    }

    private static String load() {
        try {
            return new ClassPathResource(RESOURCE_PATH).getContentAsString(StandardCharsets.UTF_8).strip();
        } catch (IOException e) {
            throw new UncheckedIOException("모델 라우팅 지시문을 읽을 수 없습니다: " + RESOURCE_PATH, e);
        }
    }
}
