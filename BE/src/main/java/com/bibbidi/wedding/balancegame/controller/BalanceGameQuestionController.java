package com.bibbidi.wedding.balancegame.controller;

import com.bibbidi.wedding.balancegame.controller.dto.BalanceGameQuestionsResponse;
import com.bibbidi.wedding.balancegame.service.BalanceGameQuestionService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class BalanceGameQuestionController {

    private final BalanceGameQuestionService questionService;

    public BalanceGameQuestionController(BalanceGameQuestionService questionService) {
        this.questionService = questionService;
    }

    @GetMapping("/api/balance-game/questions")
    public BalanceGameQuestionsResponse findAll() {
        return BalanceGameQuestionsResponse.from(questionService.findAll());
    }
}
