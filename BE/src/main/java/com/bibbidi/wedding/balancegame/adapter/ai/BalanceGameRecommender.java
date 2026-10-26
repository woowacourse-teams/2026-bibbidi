package com.bibbidi.wedding.balancegame.adapter.ai;

import com.bibbidi.wedding.balancegame.service.dto.ResolvedBalanceGameAnswer;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.ArrayList;
import java.util.List;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.bedrockruntime.model.ThrottlingException;
import tools.jackson.core.JacksonException;
import tools.jackson.core.StreamReadFeature;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
public class BalanceGameRecommender {

    private final ChatClient chatClient;
    private final ObjectMapper mapper;

    public BalanceGameRecommender(
            @Qualifier("balanceGameChatClient") ChatClient chatClient,
            ObjectMapper mapper
    ) {
        this.chatClient = chatClient;
        this.mapper = mapper;
    }

    public List<Long> recommend(List<ResolvedBalanceGameAnswer> answers, List<CatalogItemDetailSnapshot> catalog) {
        String input = mapper.writeValueAsString(new RecommendationInput(answers, catalog));
        String output;
        try {
            output = chatClient.prompt().messages(new UserMessage(input)).call().content();
        } catch (RuntimeException e) {
            for (Throwable cause = e; cause != null; cause = cause.getCause()) {
                if (cause instanceof ThrottlingException) {
                    throw new BusinessException(ClientError.AI_CAPACITY_EXCEEDED, "밸런스게임 AI 호출 한도 초과");
                }
            }
            // 공급자 예외에는 민감한 원문이 포함될 수 있어 예외 타입만 기록한다.
            throw new BusinessException(ClientError.INTERNAL_ERROR,
                    "밸런스게임 AI 호출 실패. type=" + e.getClass().getSimpleName());
        }
        return parse(output);
    }

    private List<Long> parse(String output) {
        if (output == null || output.isBlank()) {
            throw new BusinessException(ClientError.INTERNAL_ERROR, "AI 추천 응답이 비어 있습니다.");
        }
        JsonNode root;
        try {
            root = mapper.reader().with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
                    .with(StreamReadFeature.STRICT_DUPLICATE_DETECTION).readTree(output);
        } catch (JacksonException e) {
            // 파싱 예외에는 모델 출력 원문이 포함될 수 있어 로그에 전달하지 않는다.
            throw new BusinessException(ClientError.INTERNAL_ERROR, "AI 추천 응답이 JSON 형식이 아닙니다.");
        }
        if (!root.isObject() || root.size() != 1 || !root.has("recommendedItemIds")
                || !root.get("recommendedItemIds").isArray()) {
            throw new BusinessException(ClientError.INTERNAL_ERROR, "AI 추천 응답 스키마가 올바르지 않습니다.");
        }
        List<Long> ids = new ArrayList<>();
        for (JsonNode id : root.get("recommendedItemIds")) {
            if (!id.isIntegralNumber() || !id.canConvertToLong() || id.longValue() <= 0) {
                throw new BusinessException(ClientError.INTERNAL_ERROR, "AI 추천 ID는 양의 정수여야 합니다.");
            }
            ids.add(id.longValue());
        }
        return List.copyOf(ids);
    }

    private record RecommendationInput(List<ResolvedBalanceGameAnswer> answers, List<CatalogItemDetailSnapshot> catalog) {
    }

    public record RecommendationOutput(@JsonProperty(required = true) List<Long> recommendedItemIds) {
    }
}
