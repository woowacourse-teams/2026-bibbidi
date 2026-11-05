package com.bibbidi.wedding.chat.evaluation.data.result;

import java.util.List;
import java.util.function.Function;
import org.springframework.ai.chat.metadata.Usage;
import tools.jackson.databind.JsonNode;

public record ModelTokenUsage(
        Long inputTokens,
        Long outputTokens,
        Long totalTokens,
        Long cachedInputTokens,
        Long cacheWriteInputTokens,
        Long reasoningOutputTokens
) {

    public static ModelTokenUsage fromSpring(Usage usage) {
        if (usage == null) {
            return new ModelTokenUsage(null, null, null, null, null, null);
        }
        return new ModelTokenUsage(
                asLong(usage.getPromptTokens()),
                asLong(usage.getCompletionTokens()),
                asLong(usage.getTotalTokens()),
                usage.getCacheReadInputTokens(),
                usage.getCacheWriteInputTokens(),
                null);
    }

    public static ModelTokenUsage fromCodex(JsonNode usage) {
        Long input = number(usage, "input_tokens");
        Long output = number(usage, "output_tokens");
        return new ModelTokenUsage(input, output, sum(input, output),
                number(usage, "cached_input_tokens"),
                number(usage, "cache_write_input_tokens"),
                number(usage, "reasoning_output_tokens"));
    }

    public static ModelTokenUsage fromClaude(JsonNode usage) {
        Long input = number(usage, "input_tokens");
        Long output = number(usage, "output_tokens");
        Long cached = number(usage, "cache_read_input_tokens");
        Long cacheWrite = number(usage, "cache_creation_input_tokens");
        Long total = sum(input, output);
        if (total != null) {
            total += cached == null ? 0 : cached;
            total += cacheWrite == null ? 0 : cacheWrite;
        }
        JsonNode outputDetails = usage == null ? null : usage.get("output_tokens_details");
        return new ModelTokenUsage(input, output, total, cached, cacheWrite,
                number(outputDetails, "thinking_tokens"));
    }

    public static ModelTokenUsage total(List<ModelTokenUsage> usages) {
        return new ModelTokenUsage(
                sum(usages, ModelTokenUsage::inputTokens),
                sum(usages, ModelTokenUsage::outputTokens),
                sum(usages, ModelTokenUsage::totalTokens),
                sum(usages, ModelTokenUsage::cachedInputTokens),
                sum(usages, ModelTokenUsage::cacheWriteInputTokens),
                sum(usages, ModelTokenUsage::reasoningOutputTokens));
    }

    private static Long asLong(Integer value) {
        return value == null ? null : value.longValue();
    }

    private static Long number(JsonNode node, String name) {
        if (node == null) {
            return null;
        }
        JsonNode value = node.get(name);
        return value != null && value.isNumber() ? value.asLong() : null;
    }

    private static Long sum(Long first, Long second) {
        return first == null || second == null ? null : first + second;
    }

    private static Long sum(List<ModelTokenUsage> usages, Function<ModelTokenUsage, Long> field) {
        if (usages.isEmpty() || usages.stream().anyMatch(usage -> field.apply(usage) == null)) {
            return null;
        }
        return usages.stream().mapToLong(usage -> field.apply(usage)).sum();
    }
}
