package com.bibbidi.wedding.balancegame.service;

import com.bibbidi.wedding.balancegame.domain.Answer;
import com.bibbidi.wedding.balancegame.domain.Questions;
import com.bibbidi.wedding.balancegame.domain.WeddingType;
import com.bibbidi.wedding.balancegame.service.port.QuestionPort;
import com.bibbidi.wedding.balancegame.service.port.WeddingTypeClassifierPort;
import com.bibbidi.wedding.balancegame.service.port.WeddingTypePort;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class BalanceGameService {

    private final QuestionPort questionPort;
    private final WeddingTypePort weddingTypePort;
    private final WeddingTypeClassifierPort classifierPort;

    public BalanceGameService(
            QuestionPort questionPort,
            WeddingTypePort weddingTypePort,
            WeddingTypeClassifierPort classifierPort
    ) {
        this.questionPort = questionPort;
        this.weddingTypePort = weddingTypePort;
        this.classifierPort = classifierPort;
    }

    public Questions findQuestions() {
        return questionPort.findAll();
    }

    public WeddingType judge(Map<String, String> optionIds) {
        List<Answer> answers = questionPort.findAll().resolve(optionIds);

        return classifierPort.classify(answers, weddingTypePort.findAll());
    }
}
