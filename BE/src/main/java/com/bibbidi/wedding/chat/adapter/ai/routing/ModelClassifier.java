package com.bibbidi.wedding.chat.adapter.ai.routing;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.MessageType;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
@Slf4j
public class ModelClassifier {

    private static final String QUESTION_ID = "route";

    private final ChatMemory memory;
    private final ModelRoutingProperties properties;
    private final ObjectMapper mapper;
    private final HttpClient httpClient;

    @Autowired
    public ModelClassifier(ChatMemory memory, ModelRoutingProperties properties, ObjectMapper mapper) {
        this(memory, properties, mapper, HttpClient.newHttpClient());
    }

    ModelClassifier(ChatMemory memory, ModelRoutingProperties properties, ObjectMapper mapper,
                       HttpClient httpClient) {
        this.memory = memory;
        this.properties = properties;
        this.mapper = mapper;
        this.httpClient = httpClient;
    }

    public Mono<ChatModelTier> classify(String conversationKey, String userPrompt) {
        if (properties.apiKey() == null || properties.apiKey().isBlank()) {
            return Mono.just(ChatModelTier.SOL);
        }
        return Mono.fromCallable(() -> decide(conversationKey, userPrompt))
                .subscribeOn(Schedulers.boundedElastic())
                .onErrorResume(error -> {
                    log.warn("Jev 분류 실패. Sol로 처리합니다. type={}", error.getClass().getSimpleName());
                    return Mono.just(ChatModelTier.SOL);
                });
    }

    private ChatModelTier decide(String conversationKey, String userPrompt) throws IOException, InterruptedException {
        Map<String, Object> question = Map.of(
                "type", "choice",
                "instructions", "사용자의 이번 요청에 필요한 답변 모델을 선택하세요. 이전 대화나 현재 상태와 비교해야 하면 sol을 선택하세요.",
                "criteria", Map.of(
                        "qwen", "인사나 조건이 거의 없는 단순 설명",
                        "luna", "조건을 반영하는 일반적인 상담이나 추천",
                        "sol", "여러 조건의 우선순위 조정 또는 이전 대화와 현재 상태의 대조"
                )
        );
        String body = mapper.writeValueAsString(Map.of(
                "state", state(conversationKey, userPrompt),
                "model", properties.model(),
                "questions", Map.of(QUESTION_ID, question)
        ));
        HttpRequest request = HttpRequest.newBuilder(URI.create(properties.endpoint()))
                .timeout(properties.timeout())
                .header("Authorization", "Bearer " + properties.apiKey())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() / 100 != 2) {
            throw new IOException("Jev HTTP " + response.statusCode());
        }
        JsonNode answer = mapper.readTree(response.body()).path("answers").path(QUESTION_ID);
        ChatModelTier choice = ChatModelTier.fromChoice(answer.path("choice").asText())
                .orElseThrow(() -> new IOException("Jev choice missing or invalid"));
        if (!answer.path("confidence").isNumber()) {
            return choice.higher();
        }
        return answer.path("confidence").asDouble() < properties.minConfidence()
                ? choice.higher() : choice;
    }

    private String state(String conversationKey, String userPrompt) {
        List<Message> history = memory.get(conversationKey).stream()
                .filter(message -> message.getMessageType() == MessageType.USER
                        || message.getMessageType() == MessageType.ASSISTANT)
                .toList();
        int from = Math.max(0, history.size() - properties.historyMessages());
        StringBuilder state = new StringBuilder();
        for (Message message : history.subList(from, history.size())) {
            state.append(message.getMessageType().getValue()).append(": ")
                    .append(message.getText()).append('\n');
        }
        return state.append("user: ").append(userPrompt).toString();
    }
}
