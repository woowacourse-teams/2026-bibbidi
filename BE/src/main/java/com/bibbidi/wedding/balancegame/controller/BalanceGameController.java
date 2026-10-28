package com.bibbidi.wedding.balancegame.controller;

import com.bibbidi.wedding.balancegame.controller.dto.BalanceGameQuestionsResponse;
import com.bibbidi.wedding.balancegame.controller.dto.BalanceGameResultRequest;
import com.bibbidi.wedding.balancegame.controller.dto.BalanceGameResultResponse;
import com.bibbidi.wedding.balancegame.service.BalanceGameService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class BalanceGameController {

    private final BalanceGameService balanceGameService;

    public BalanceGameController(BalanceGameService balanceGameService) {
        this.balanceGameService = balanceGameService;
    }

    @GetMapping("/api/balance-game/questions")
    public BalanceGameQuestionsResponse findQuestions() {
        return BalanceGameQuestionsResponse.from(balanceGameService.findQuestions());
    }

    @PostMapping("/api/balance-game/results")
    public BalanceGameResultResponse judge(@Valid @RequestBody BalanceGameResultRequest request) {
        return BalanceGameResultResponse.from(balanceGameService.judge(request.answers()));
    }
}
