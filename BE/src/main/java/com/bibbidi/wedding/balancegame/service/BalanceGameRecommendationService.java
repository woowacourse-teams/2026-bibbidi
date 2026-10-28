package com.bibbidi.wedding.balancegame.service;

import com.bibbidi.wedding.balancegame.domain.BalanceGameQuestion;
import com.bibbidi.wedding.balancegame.repository.BalanceGameRecommendationRuleRepository;
import com.bibbidi.wedding.balancegame.service.dto.BalanceGameAnswer;
import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class BalanceGameRecommendationService {

    private final BalanceGameQuestionService questionService;
    private final CatalogService catalogService;
    private final BalanceGameRecommendationRuleRepository ruleRepository;

    public BalanceGameRecommendationService(
            BalanceGameQuestionService questionService,
            CatalogService catalogService,
            BalanceGameRecommendationRuleRepository ruleRepository
    ) {
        this.questionService = questionService;
        this.catalogService = catalogService;
        this.ruleRepository = ruleRepository;
    }

    public List<CatalogItemDetailSnapshot> recommend(List<BalanceGameAnswer> answers) {
        Map<Long, String> optionIdsByQuestion = validateAndIndexAnswers(answers);
        Map<Long, CatalogItemDetailSnapshot> itemsById = loadAndValidateCatalogItems();
        List<Long> recommendedIds = selectRecommendationItemIds(optionIdsByQuestion);
        return recommendedIds.stream().map(itemsById::get).toList();
    }

    private Map<Long, String> validateAndIndexAnswers(List<BalanceGameAnswer> answers) {
        Map<Long, String> optionIdsByQuestion = new HashMap<>();
        for (BalanceGameAnswer answer : answers) {
            if (optionIdsByQuestion.putIfAbsent(answer.questionId(), answer.optionId()) != null) {
                throw new BusinessException(ClientError.INVALID_REQUEST,
                        "밸런스게임 답변 문항이 중복됩니다: questionId=" + answer.questionId());
            }
            if (questionService.findById(answer.questionId()).isEmpty()) {
                throw new BusinessException(ClientError.INVALID_REQUEST,
                        "밸런스게임 문항이 없습니다: questionId=" + answer.questionId());
            }
            if (questionService.findChoice(answer.questionId(), answer.optionId()).isEmpty()) {
                throw new BusinessException(ClientError.INVALID_REQUEST,
                        "밸런스게임 선택지가 없습니다: questionId=" + answer.questionId());
            }
        }
        if (optionIdsByQuestion.size() != questionService.findAll().size()) {
            throw new BusinessException(ClientError.INVALID_REQUEST, "밸런스게임 전체 문항에 답변해야 합니다.");
        }
        return optionIdsByQuestion;
    }

    private Map<Long, CatalogItemDetailSnapshot> loadAndValidateCatalogItems() {
        Map<Long, CatalogItemDetailSnapshot> itemsById = catalogService.findAllItemDetails().stream()
                .collect(Collectors.toMap(CatalogItemDetailSnapshot::id, Function.identity()));
        for (Long itemId : ruleRepository.findAllItemIds()) {
            if (!itemsById.containsKey(itemId)) {
                throw new BusinessException(ClientError.INTERNAL_ERROR,
                        "밸런스게임 추천 규칙의 카탈로그 항목이 없습니다: id=" + itemId);
            }
        }
        return itemsById;
    }

    private List<Long> selectRecommendationItemIds(Map<Long, String> optionIdsByQuestion) {
        Set<Long> recommendedIds = new LinkedHashSet<>(ruleRepository.findBaseItemIds());
        for (BalanceGameQuestion question : questionService.findAll()) {
            recommendedIds.addAll(ruleRepository.findOptionItemIds(question.id(), optionIdsByQuestion.get(question.id())));
        }
        return List.copyOf(recommendedIds);
    }
}
