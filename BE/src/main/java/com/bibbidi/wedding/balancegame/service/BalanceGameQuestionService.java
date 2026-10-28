package com.bibbidi.wedding.balancegame.service;

import com.bibbidi.wedding.balancegame.domain.BalanceGameQuestion;
import com.bibbidi.wedding.balancegame.domain.BalanceGameQuestion.Choice;
import com.bibbidi.wedding.balancegame.repository.BalanceGameQuestionRepository;
import java.util.List;
import java.util.Optional;
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

    public Optional<BalanceGameQuestion> findById(Long questionId) {
        return questionRepository.findById(questionId);
    }

    public Optional<Choice> findChoice(Long questionId, String choiceId) {
        return findById(questionId).flatMap(question -> question.findChoice(choiceId));
    }
}
