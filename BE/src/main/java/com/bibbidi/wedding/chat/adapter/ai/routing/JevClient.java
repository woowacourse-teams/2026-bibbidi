package com.bibbidi.wedding.chat.adapter.ai.routing;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
public class JevClient {

    private final ModelRoutingProperties properties;
    private final ObjectMapper mapper;
    private final HttpClient httpClient;

    @Autowired
    public JevClient(ModelRoutingProperties properties, ObjectMapper mapper) {
        this(properties, mapper, HttpClient.newHttpClient());
    }

    JevClient(ModelRoutingProperties properties, ObjectMapper mapper, HttpClient httpClient) {
        this.properties = properties;
        this.mapper = mapper;
        this.httpClient = httpClient;
    }

    public Choice choose(Question question) {
        return choose(question.state(), List.of(question)).get(question.id());
    }

    public Map<String, Choice> choose(String state, List<Question> questions) {
        HttpResponse<String> response = requestToJevServer(state, questions);

        if (response.statusCode() / 100 != 2) {
            throw new BusinessException(ClientError.INTERNAL_ERROR, "Jev 요청 실패. status=" + response.statusCode());
        }
        JsonNode answers = mapper.readTree(response.body()).path("answers");
        Map<String, Choice> choices = new LinkedHashMap<>();
        for (Question question : questions) {
            JsonNode answer = answers.path(question.id());
            JsonNode confidence = answer.path("confidence");
            choices.put(
                    question.id(),
                    new Choice(answer.path("choice").asText(), confidence.isNumber() ? confidence.asDouble() : null)
            );
        }
        return Map.copyOf(choices);
    }

    private HttpResponse<String> requestToJevServer(String state, List<Question> questions) {
        HttpRequest request = HttpRequest.newBuilder(URI.create(properties.endpoint()))
                .timeout(properties.timeout())
                .header("Authorization", "Bearer " + properties.apiKey())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(classifyRequestBody(state, questions), StandardCharsets.UTF_8))
                .build();

        try {
            return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) {
            throw new BusinessException(ClientError.INTERNAL_ERROR, "Jev 요청 중 입출력 오류가 발생했습니다.", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BusinessException(ClientError.INTERNAL_ERROR, "Jev 요청이 중단되었습니다.", e);
        }
    }

    private String classifyRequestBody(String state, List<Question> questions) {
        Map<String, Object> questionSpecs = new LinkedHashMap<>();
        for (Question question : questions) {
            questionSpecs.put(question.id(), Map.of(
                    "type", "choice",
                    "instructions", question.instructions(),
                    "criteria", question.criteria()));
        }
        return mapper.writeValueAsString(
                Map.of(
                        "state", state,
                        "model", properties.model(),
                        "questions", questionSpecs
                )
        );
    }

    public record Question(String id, String state, String instructions, Map<String, String> criteria) {
    }

    public record Choice(String value, @Nullable Double confidence) {

        public boolean isUnsure(double minConfidence) {
            return confidence == null || confidence < minConfidence;
        }
    }
}
