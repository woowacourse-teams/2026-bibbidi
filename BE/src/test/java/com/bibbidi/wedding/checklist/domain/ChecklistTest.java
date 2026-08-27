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
}
