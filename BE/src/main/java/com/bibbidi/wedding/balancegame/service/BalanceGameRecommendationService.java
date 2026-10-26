package com.bibbidi.wedding.balancegame.service;

import com.bibbidi.wedding.balancegame.adapter.ai.BalanceGameRecommender;
import com.bibbidi.wedding.balancegame.domain.BalanceGameQuestion;
import com.bibbidi.wedding.balancegame.domain.BalanceGameQuestion.Choice;
import com.bibbidi.wedding.balancegame.repository.BalanceGameQuestionRepository;
import com.bibbidi.wedding.balancegame.service.dto.BalanceGameAnswer;
import com.bibbidi.wedding.balancegame.service.dto.ResolvedBalanceGameAnswer;
import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class BalanceGameRecommendationService {

    private final BalanceGameQuestionRepository questionRepository;
    private final CatalogService catalogService;
    private final BalanceGameRecommender recommender;

    public BalanceGameRecommendationService(
            BalanceGameQuestionRepository questionRepository,
            CatalogService catalogService,
            BalanceGameRecommender recommender
    ) {
        this.questionRepository = questionRepository;
        this.catalogService = catalogService;
        this.recommender = recommender;
    }

    public List<CatalogItemDetailSnapshot> recommend(List<BalanceGameAnswer> answers) {
        List<ResolvedBalanceGameAnswer> resolved = resolve(answers);
        List<CatalogItemDetailSnapshot> catalog = catalogService.findAllItemDetails();
        List<Long> recommendedIds = recommender.recommend(resolved, catalog);
        Map<Long, CatalogItemDetailSnapshot> itemsById = catalog.stream()
                .collect(Collectors.toMap(CatalogItemDetailSnapshot::id, Function.identity()));
        return recommendedIds.stream().distinct().map(id -> {
            CatalogItemDetailSnapshot item = itemsById.get(id);
            if (item == null) {
                throw new BusinessException(ClientError.INTERNAL_ERROR,
                        "AI가 후보에 없는 준비항목을 추천했습니다: id=" + id);
            }
            return item;
        }).toList();
    }

    private List<ResolvedBalanceGameAnswer> resolve(List<BalanceGameAnswer> answers) {
        Set<Long> answeredIds = new HashSet<>();
        List<ResolvedBalanceGameAnswer> resolved = new ArrayList<>();
        for (BalanceGameAnswer answer : answers) {
            if (!answeredIds.add(answer.questionId())) {
                throw new BusinessException(ClientError.INVALID_REQUEST,
                        "밸런스게임 답변 문항이 중복됩니다: questionId=" + answer.questionId());
            }
            BalanceGameQuestion question = questionRepository.findById(answer.questionId())
                    .orElseThrow(() -> new BusinessException(ClientError.INVALID_REQUEST,
                            "밸런스게임 문항이 없습니다: questionId=" + answer.questionId()));
            Choice option = questionRepository.findOptionById(answer.questionId(), answer.optionId())
                    .orElseThrow(() -> new BusinessException(ClientError.INVALID_REQUEST,
                            "밸런스게임 선택지가 없습니다: questionId=" + answer.questionId()));
            resolved.add(new ResolvedBalanceGameAnswer(question.id(), question.question(), option.id(), option.text()));
        }
        if (answeredIds.size() != questionRepository.findAll().size()) {
            throw new BusinessException(ClientError.INVALID_REQUEST, "밸런스게임 전체 문항에 답변해야 합니다.");
        }
        return List.copyOf(resolved);
    }
}
