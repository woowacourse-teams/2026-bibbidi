package com.bibbidi.wedding.checklist.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ChecklistItemDoneStatusTest {

    private static ChecklistItem constructItem(ChecklistItemStatus status) {
        return new ChecklistItem(1L, 10L, "웨딩홀 투어", null, status);
    }

    @Test
    @DisplayName("시작 전 할 일은 완료되지 않은 할 일이다")
    void shouldNotBeDoneWhenPrev() {
        // given
        ChecklistItem item = constructItem(ChecklistItemStatus.PREV);

        // when
        boolean done = item.isDone();

        // then
        assertThat(done).isFalse();
    }

    @Test
    @DisplayName("진행 중 할 일은 완료되지 않은 할 일이다")
    void shouldNotBeDoneWhenContinue() {
        // given
        ChecklistItem item = constructItem(ChecklistItemStatus.CONTINUE);

        // when
        boolean done = item.isDone();

        // then
        assertThat(done).isFalse();
    }

    @Test
    @DisplayName("완료 할 일은 완료된 할 일이다")
    void shouldBeDoneWhenDone() {
        // given
        ChecklistItem item = constructItem(ChecklistItemStatus.DONE);

        // when
        boolean done = item.isDone();

        // then
        assertThat(done).isTrue();
    }
}
