package com.bibbidi.wedding.balancegame.controller;

import com.bibbidi.wedding.balancegame.controller.dto.BalanceGameRecommendationRequest;
import com.bibbidi.wedding.balancegame.controller.dto.BalanceGameRecommendationResponse;
import com.bibbidi.wedding.balancegame.service.BalanceGameRecommendationService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class BalanceGameRecommendationController {

    private final BalanceGameRecommendationService recommendationService;

    public BalanceGameRecommendationController(BalanceGameRecommendationService recommendationService) {
        this.recommendationService = recommendationService;
    }

    @PostMapping("/api/balance-game/recommendations")
    public BalanceGameRecommendationResponse recommend(@Valid @RequestBody BalanceGameRecommendationRequest request) {
        return BalanceGameRecommendationResponse.from(recommendationService.recommend(request.toAnswers()));
    }
}
