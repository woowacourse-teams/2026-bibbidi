package com.bibbidi.wedding.balancegame.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.balancegame.domain.BalanceGameQuestion.Choice;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class BalanceGameQuestionTest {

    @Test
    @DisplayName("한 문항 안의 선택지 ID가 중복되면 문항과 선택지 ID를 알리며 실패한다")
    void shouldRejectDuplicateChoiceId() {
        List<Choice> choices = List.of(
                new Choice("B", "첫 번째 선택지", null),
                new Choice("B", "두 번째 선택지", null));

        assertThatThrownBy(() -> new BalanceGameQuestion(10L, 1, "질문", choices))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContainingAll("선택지 ID가 중복", "questionId=10", "choiceId=B");
    }

    @Test
    @DisplayName("선택지 표시 순서를 유지하고 원본과 반환 목록의 변경으로부터 보호한다")
    void shouldPreserveChoiceOrderAndImmutability() {
        List<Choice> choices = new ArrayList<>(List.of(
                new Choice("B", "먼저 표시할 선택지", null),
                new Choice("UNKNOWN", "아직 잘 모르겠어", null),
                new Choice("A", "나중에 표시할 선택지", null)));

        BalanceGameQuestion question = new BalanceGameQuestion(10L, 1, "질문", choices);
        choices.clear();

        assertThat(question.choices()).extracting(Choice::id).containsExactly("B", "UNKNOWN", "A");
        assertThatThrownBy(() -> question.choices().clear()).isInstanceOf(UnsupportedOperationException.class);
    }
}
