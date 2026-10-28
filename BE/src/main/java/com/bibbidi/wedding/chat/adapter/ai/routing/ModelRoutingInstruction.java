package com.bibbidi.wedding.chat.adapter.ai.routing;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

@Component
public class ModelRoutingInstruction {

    private static final String ROUTE_PATH = "prompts/model-routing/instructions.txt";
    private static final String INJECTION_PATH = "prompts/model-routing/injection-instructions.txt";
    private static final String HIJACK_PATH = "prompts/model-routing/hijack-instructions.txt";

    private final String route;
    private final String injection;
    private final String hijack;

    public ModelRoutingInstruction() {
        this.route = load(ROUTE_PATH);
        this.injection = load(INJECTION_PATH);
        this.hijack = load(HIJACK_PATH);
    }

    public String route() {
        return route;
    }

    public String injection() {
        return injection;
    }

    public String hijack() {
        return hijack;
    }

    private static String load(String resourcePath) {
        try {
            return new ClassPathResource(resourcePath).getContentAsString(StandardCharsets.UTF_8).strip();
        } catch (IOException e) {
            throw new UncheckedIOException("모델 라우팅 지시문을 읽을 수 없습니다: " + resourcePath, e);
        }
    }
}
