package com.bibbidi.wedding.chat.evaluation.local;

import java.util.ArrayList;
import java.util.List;
import tools.jackson.databind.JsonNode;

class LocalEvaluationAnswer {

    private String text = "";
    private final List<Long> recommendedItemIds = new ArrayList<>();

    void readResponse(JsonNode response) {
        validateResponse(response);
        text = response.path("answer").asText();
        readRecommendedItemIds(response.path("recommendedItemIds"));
    }

    String text() {
        return text;
    }

    List<Long> recommendedItemIds() {
        return List.copyOf(recommendedItemIds);
    }

    private void validateResponse(JsonNode response) {
        JsonNode answer = response.path("answer");
        JsonNode ids = response.path("recommendedItemIds");
        if (!answer.isTextual() || answer.asText().isBlank() || !ids.isArray()) {
            throw new IllegalStateException("Model response must contain answer and recommendedItemIds");
        }
    }

    private void readRecommendedItemIds(JsonNode values) {
        for (JsonNode id : values) {
            if (!id.isIntegralNumber() || !id.canConvertToLong()) {
                throw new IllegalStateException("recommendedItemIds must contain integers");
            }
            recommendedItemIds.add(id.asLong());
        }
    }
}
