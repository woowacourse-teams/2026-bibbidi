package com.bibbidi.wedding.balancegame.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.balancegame.domain.BalanceGameQuestion.Choice;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class BalanceGameQuestionsTest {

    private static final BalanceGameQuestion FIRST = new BalanceGameQuestion(
            10L, 1, "먼저 표시할 질문", List.of(new Choice("A", "선택지", null)));
    private static final BalanceGameQuestion SECOND = new BalanceGameQuestion(
            5L, 2, "나중에 표시할 질문", List.of(new Choice("A", "선택지", null)));

    @Test
    @DisplayName("문항 ID 대신 노출 순서 오름차순으로 정렬한다")
    void shouldSortQuestionsByOrder() {
        BalanceGameQuestions questions = new BalanceGameQuestions(List.of(SECOND, FIRST));

        assertThat(questions.values()).extracting(BalanceGameQuestion::id).containsExactly(10L, 5L);
        assertThat(questions.values()).extracting(BalanceGameQuestion::order).containsExactly(1, 2);
    }

    @Test
    @DisplayName("원본과 반환 목록의 변경으로부터 문항 목록을 보호한다")
    void shouldKeepQuestionsImmutable() {
        List<BalanceGameQuestion> source = new ArrayList<>(List.of(SECOND, FIRST));
        BalanceGameQuestions questions = new BalanceGameQuestions(source);
        source.clear();

        assertThat(questions.values()).containsExactly(FIRST, SECOND);
        assertThatThrownBy(() -> questions.values().clear()).isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    @DisplayName("문항 ID가 중복되면 문항 ID를 알리며 실패한다")
    void shouldRejectDuplicateQuestionId() {
        BalanceGameQuestion duplicate = new BalanceGameQuestion(FIRST.id(), 2, "다른 질문", FIRST.choices());

        assertThatThrownBy(() -> new BalanceGameQuestions(List.of(FIRST, duplicate)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContainingAll("문항 ID가 중복", "id=10");
    }

    @Test
    @DisplayName("문항 노출 순서가 중복되면 해당 순서를 알리며 실패한다")
    void shouldRejectDuplicateOrder() {
        BalanceGameQuestion duplicate = new BalanceGameQuestion(20L, FIRST.order(), "다른 질문", FIRST.choices());

        assertThatThrownBy(() -> new BalanceGameQuestions(List.of(FIRST, duplicate)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContainingAll("노출 순서가 중복", "order=1");
    }
}
