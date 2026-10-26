package com.bibbidi.wedding.balancegame.controller.dto;

import com.bibbidi.wedding.balancegame.domain.BalanceGameQuestion;
import java.util.List;

public record BalanceGameQuestionsResponse(
        List<QuestionResponse> questions
) {

    public static BalanceGameQuestionsResponse from(List<BalanceGameQuestion> questions) {
        return new BalanceGameQuestionsResponse(questions.stream()
                .map(question -> new QuestionResponse(
                        question.id(), question.order(), question.question(),
                        question.options().stream()
                                .map(option -> new OptionResponse(option.id(), option.text(), option.imageUrl()))
                                .toList()))
                .toList());
    }

    public record QuestionResponse(
            Long id,
            int order,
            String question,
            List<OptionResponse> options
    ) {
    }

    public record OptionResponse(
            String id,
            String text,
            String imageUrl
    ) {
    }
}
