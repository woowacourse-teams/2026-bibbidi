package com.bibbidi.wedding.balancegame.service.port;

import com.bibbidi.wedding.balancegame.domain.Answer;
import com.bibbidi.wedding.balancegame.domain.WeddingType;
import java.util.List;

public interface WeddingTypeClassifierPort {

    WeddingType classify(List<Answer> answers, List<WeddingType> candidates);
}
