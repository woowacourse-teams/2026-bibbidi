package com.bibbidi.wedding.chat.adapter.ai.routing;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

@Component
public class ModelRoutingCriteria {

    private static final String ROUTE_PATH = "prompts/model-routing/criteria.txt";
    private static final String INJECTION_PATH = "prompts/model-routing/injection-criteria.txt";
    private static final String HIJACK_PATH = "prompts/model-routing/hijack-criteria.txt";

    private final Map<String, String> route;
    private final Map<String, String> injection;
    private final Map<String, String> hijack;

    public ModelRoutingCriteria() {
        this.route = load(ROUTE_PATH);
        this.injection = load(INJECTION_PATH);
        this.hijack = load(HIJACK_PATH);
    }

    public Map<String, String> route() {
        return route;
    }

    public Map<String, String> injection() {
        return injection;
    }

    public Map<String, String> hijack() {
        return hijack;
    }

    private static Map<String, String> load(String resourcePath) {
        try {
            return new ClassPathResource(resourcePath).getContentAsString(StandardCharsets.UTF_8).lines()
                    .filter(line -> !line.isBlank())
                    .map(line -> line.split("=", 2))
                    .collect(Collectors.toUnmodifiableMap(parts -> parts[0].strip(), parts -> parts[1].strip()));
        } catch (IOException e) {
            throw new UncheckedIOException("모델 라우팅 기준을 읽을 수 없습니다: " + resourcePath, e);
        }
    }
}
