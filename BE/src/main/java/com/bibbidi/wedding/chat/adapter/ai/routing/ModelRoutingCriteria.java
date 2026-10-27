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

    private static final String RESOURCE_PATH = "prompts/model-routing/criteria.txt";

    private final Map<String, String> byChoice;

    public ModelRoutingCriteria() {
        this.byChoice = load();
    }

    public Map<String, String> byChoice() {
        return byChoice;
    }

    private static Map<String, String> load() {
        try {
            return new ClassPathResource(RESOURCE_PATH).getContentAsString(StandardCharsets.UTF_8).lines()
                    .filter(line -> !line.isBlank())
                    .map(line -> line.split("=", 2))
                    .collect(Collectors.toUnmodifiableMap(parts -> parts[0].strip(), parts -> parts[1].strip()));
        } catch (IOException e) {
            throw new UncheckedIOException("모델 라우팅 기준을 읽을 수 없습니다: " + RESOURCE_PATH, e);
        }
    }
}
