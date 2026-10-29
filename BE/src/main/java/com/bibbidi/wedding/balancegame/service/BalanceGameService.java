package com.bibbidi.wedding.balancegame.service;

import com.bibbidi.wedding.balancegame.adapter.ai.SpringAiWeddingTypeClassifier;
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
    private final SpringAiWeddingTypeClassifier classifier;

    public BalanceGameService(
            QuestionRepository questionRepository,
            WeddingTypeRepository weddingTypeRepository,
            SpringAiWeddingTypeClassifier classifier
    ) {
        this.questionRepository = questionRepository;
        this.weddingTypeRepository = weddingTypeRepository;
        this.classifier = classifier;
    }

    public Questions findQuestions() {
        return questionRepository.findAll();
    }

    public WeddingType judge(Map<String, String> optionIds) {
        List<Answer> answers = questionRepository.findAll().resolve(optionIds);

        return classifier.classify(answers, weddingTypeRepository.findAll());
    }
}
