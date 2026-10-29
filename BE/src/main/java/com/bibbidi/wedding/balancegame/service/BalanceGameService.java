package com.bibbidi.wedding.balancegame.service;

import com.bibbidi.wedding.balancegame.client.BalanceGameAiClient;
import com.bibbidi.wedding.balancegame.domain.Answer;
import com.bibbidi.wedding.balancegame.domain.Questions;
import com.bibbidi.wedding.balancegame.domain.WeddingType;
import com.bibbidi.wedding.balancegame.repository.QuestionRepository;
import com.bibbidi.wedding.balancegame.repository.WeddingTypeRepository;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class BalanceGameService {

    private final QuestionRepository questionRepository;
    private final WeddingTypeRepository weddingTypeRepository;
    private final BalanceGameAiClient aiClient;

    public BalanceGameService(
            QuestionRepository questionRepository,
            WeddingTypeRepository weddingTypeRepository,
            BalanceGameAiClient aiClient
    ) {
        this.questionRepository = questionRepository;
        this.weddingTypeRepository = weddingTypeRepository;
        this.aiClient = aiClient;
    }

    public Questions findQuestions() {
        return questionRepository.findAll();
    }

    public WeddingType judge(Map<String, String> optionIds) {
        List<Answer> answers = questionRepository.findAll().resolve(optionIds);

        return aiClient.classify(answers, weddingTypeRepository.findAll());
    }
}
