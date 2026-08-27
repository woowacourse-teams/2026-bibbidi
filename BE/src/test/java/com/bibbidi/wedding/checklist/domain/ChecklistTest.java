package com.bibbidi.wedding.checklist.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ChecklistTest {

    @Test
    @DisplayName("새 체크리스트는 식별자 없이 소유자만 정해진다")
    void shouldHaveOnlyOwnerWhenCreated() {
        // given, when
        Checklist checklist = new Checklist(null, 1L);

        // then
        assertThat(checklist)
                .extracting(Checklist::id, Checklist::ownerId)
                .containsExactly(null, 1L);
    }

    @Test
    @DisplayName("자신에게 속한 할 일이면 소유를 인정한다")
    void shouldOwnChecklistItemOfItself() {
        // given
        Checklist checklist = new Checklist(10L, 1L);
        ChecklistItem item = new ChecklistItem(200L, 10L, 2L, "계약서 확인", 100L, ChecklistItemStatus.PREV);

        // when, then
        assertThat(checklist.owns(item)).isTrue();
    }

    @Test
    @DisplayName("다른 체크리스트에 속한 할 일이면 소유를 인정하지 않는다")
    void shouldNotOwnChecklistItemOfAnotherChecklist() {
        // given
        Checklist checklist = new Checklist(10L, 1L);
        ChecklistItem item = new ChecklistItem(200L, 99L, 2L, "계약서 확인", 100L, ChecklistItemStatus.PREV);

        // when, then
        assertThat(checklist.owns(item)).isFalse();
    }
}
