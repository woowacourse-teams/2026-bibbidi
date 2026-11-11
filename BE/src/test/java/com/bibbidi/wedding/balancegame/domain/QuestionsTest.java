package com.bibbidi.wedding.balancegame.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.groups.Tuple.tuple;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class QuestionsTest {

    @Test
    @DisplayName("고른 선택지를 문항과 묶고, 답하지 않은 문항과 지금 없는 문항 ID는 뺀다")
    void shouldResolveOnlyAnsweredQuestions() {
        Questions questions = new Questions(List.of(question("Q1"), question("Q2")));

        List<Answer> answers = questions.resolve(Map.of("Q2", "B", "REMOVED", "A"));

        assertThat(answers).extracting(Answer::questionText, Answer::selectedText)
                .containsExactly(tuple("Q2 질문", "Q2 선택지 B"));
    }

    private static Question question(String id) {
        return new Question(id, id + " 질문", List.of(
                new Option("A", id + " 선택지 A", "https://example.com/a.webp"),
                new Option("B", id + " 선택지 B", "https://example.com/b.webp")
        ));
    }
}
