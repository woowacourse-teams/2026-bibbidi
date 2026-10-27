package com.bibbidi.wedding.balancegame.controller.dto;

import com.bibbidi.wedding.balancegame.domain.BalanceGameQuestion;
import com.bibbidi.wedding.balancegame.domain.BalanceGameQuestion.Choice;
import java.util.List;

public record BalanceGameQuestionsResponse(
        List<QuestionResponse> questions
) {

    public static BalanceGameQuestionsResponse from(List<BalanceGameQuestion> questions) {
        return new BalanceGameQuestionsResponse(questions.stream()
                .map(QuestionResponse::from)
                .toList());
    }

    public record QuestionResponse(
            Long id,
            int order,
            String question,
            List<ChoiceResponse> options
    ) {

        public static QuestionResponse from(BalanceGameQuestion question) {
            return new QuestionResponse(
                    question.id(),
                    question.order(),
                    question.content(),
                    question.choices().stream()
                            .map(ChoiceResponse::from)
                            .toList()
            );
        }
    }

    public record ChoiceResponse(
            String id,
            String text,
            String imageUrl
    ) {

        public static ChoiceResponse from(Choice choice) {
            return new ChoiceResponse(choice.id(), choice.text(), choice.imageUrl());
        }
    }
}
