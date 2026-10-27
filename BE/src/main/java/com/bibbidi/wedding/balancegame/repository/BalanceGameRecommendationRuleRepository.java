package com.bibbidi.wedding.balancegame.repository;

import com.bibbidi.wedding.balancegame.domain.BalanceGameQuestion;
import com.bibbidi.wedding.balancegame.repository.dto.BalanceGameRecommendationRules;
import com.bibbidi.wedding.balancegame.repository.dto.QuestionRecommendationRule;
import jakarta.validation.Validator;
import java.io.IOException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Repository;
import tools.jackson.core.JacksonException;
import tools.jackson.core.StreamReadFeature;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.ObjectMapper;

@Repository
public class BalanceGameRecommendationRuleRepository {

    private final List<Long> baseItemIds;
    private final Map<Long, Map<String, List<Long>>> optionItemIdsByQuestion;
    private final Set<Long> allItemIds;

    public BalanceGameRecommendationRuleRepository(
            ObjectMapper mapper,
            Validator validator,
            BalanceGameQuestionRepository questionRepository,
            @Value("classpath:balance-game/recommendation-rules.json") Resource resource
    ) {
        BalanceGameRecommendationRules recommendationRules = readFile(mapper, resource);
        validateRequiredValues(recommendationRules, validator, resource);
        validateQuestionReferences(recommendationRules.rules(), questionRepository);
        this.baseItemIds = List.copyOf(recommendationRules.baseItemIds());
        this.optionItemIdsByQuestion = indexOptionItemIds(recommendationRules.rules());
        this.allItemIds = collectReferencedItemIds(baseItemIds, optionItemIdsByQuestion);
    }

    public List<Long> findBaseItemIds() {
        return baseItemIds;
    }

    public List<Long> findOptionItemIds(Long questionId, String optionId) {
        return optionItemIdsByQuestion.get(questionId).get(optionId);
    }

    public Set<Long> findAllItemIds() {
        return allItemIds;
    }

    private static BalanceGameRecommendationRules readFile(ObjectMapper mapper, Resource resource) {
        try {
            return mapper.readerFor(BalanceGameRecommendationRules.class)
                    .with(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES,
                            DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
                    .with(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
                    .without(DeserializationFeature.ACCEPT_FLOAT_AS_INT)
                    .readValue(resource.getContentAsByteArray());
        } catch (IOException | JacksonException e) {
            throw new IllegalStateException("밸런스게임 추천 규칙 파일을 읽을 수 없습니다: " + resource.getDescription(), e);
        }
    }

    private static void validateRequiredValues(
            BalanceGameRecommendationRules rules, Validator validator, Resource resource
    ) {
        if (rules == null) {
            throw new IllegalStateException("밸런스게임 추천 규칙 파일이 null입니다: " + resource.getDescription());
        }
        String violations = validator.validate(rules).stream()
                .map(violation -> violation.getPropertyPath() + ": " + violation.getMessage())
                .sorted()
                .collect(Collectors.joining(", "));
        if (!violations.isEmpty()) {
            throw new IllegalStateException("밸런스게임 추천 규칙의 필수 값이 올바르지 않습니다: "
                    + resource.getDescription() + " / " + violations);
        }
    }

    private static void validateQuestionReferences(
            List<QuestionRecommendationRule> rules, BalanceGameQuestionRepository questionRepository
    ) {
        Set<Long> questionIds = new HashSet<>();
        for (QuestionRecommendationRule rule : rules) {
            if (!questionIds.add(rule.questionId())) {
                throw new IllegalStateException("밸런스게임 추천 규칙의 문항이 중복됩니다: questionId=" + rule.questionId());
            }
            BalanceGameQuestion question = questionRepository.findById(rule.questionId())
                    .orElseThrow(() -> new IllegalStateException(
                            "밸런스게임 추천 규칙의 문항이 없습니다: questionId=" + rule.questionId()));
            Set<String> optionIds = question.options().stream()
                    .map(BalanceGameQuestion.Choice::id).collect(Collectors.toSet());
            if (!optionIds.equals(rule.optionItemIds().keySet())) {
                throw new IllegalStateException("밸런스게임 추천 규칙의 선택지가 누락되거나 존재하지 않습니다: questionId="
                        + rule.questionId());
            }
        }
        if (questionIds.size() != questionRepository.findAll().size()) {
            throw new IllegalStateException("밸런스게임 전체 문항의 추천 규칙이 필요합니다.");
        }
    }

    private static Map<Long, Map<String, List<Long>>> indexOptionItemIds(List<QuestionRecommendationRule> rules) {
        Map<Long, Map<String, List<Long>>> rulesByQuestion = new HashMap<>();
        for (QuestionRecommendationRule rule : rules) {
            Map<String, List<Long>> options = new HashMap<>();
            rule.optionItemIds().forEach((optionId, ids) -> options.put(optionId, List.copyOf(ids)));
            rulesByQuestion.put(rule.questionId(), Map.copyOf(options));
        }
        return Map.copyOf(rulesByQuestion);
    }

    private static Set<Long> collectReferencedItemIds(
            List<Long> baseItemIds, Map<Long, Map<String, List<Long>>> optionItemIdsByQuestion
    ) {
        Set<Long> itemIds = new HashSet<>(baseItemIds);
        for (Map<String, List<Long>> options : optionItemIdsByQuestion.values()) {
            for (List<Long> optionItemIds : options.values()) {
                itemIds.addAll(optionItemIds);
            }
        }
        return Set.copyOf(itemIds);
    }
}
