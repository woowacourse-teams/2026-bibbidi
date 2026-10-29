package com.bibbidi.wedding.balancegame.controller.dto;

import com.bibbidi.wedding.balancegame.domain.Option;
import com.bibbidi.wedding.balancegame.domain.Question;
import com.bibbidi.wedding.balancegame.domain.Questions;
import java.util.List;

public record BalanceGameQuestionsResponse(List<QuestionResponse> questions) {

    public static BalanceGameQuestionsResponse from(Questions questions) {
        return new BalanceGameQuestionsResponse(questions.values().stream()
                .map(QuestionResponse::from)
                .toList());
    }

    public record QuestionResponse(String id, String text, List<OptionResponse> options) {

        public static QuestionResponse from(Question question) {
            return new QuestionResponse(question.id(), question.text(), question.options().stream()
                    .map(OptionResponse::from)
                    .toList());
        }
    }

    public record OptionResponse(String id, String text) {

        public static OptionResponse from(Option option) {
            return new OptionResponse(option.id(), option.text());
        }
    }
}
