package com.bibbidi.wedding.balancegame.service;

import com.bibbidi.wedding.balancegame.domain.BalanceGameQuestion;
import com.bibbidi.wedding.balancegame.repository.BalanceGameQuestionRepository;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class BalanceGameQuestionService {

    private final BalanceGameQuestionRepository questionRepository;

    public BalanceGameQuestionService(BalanceGameQuestionRepository questionRepository) {
        this.questionRepository = questionRepository;
    }

    public List<BalanceGameQuestion> findAll() {
        return questionRepository.findAll();
    }
}
