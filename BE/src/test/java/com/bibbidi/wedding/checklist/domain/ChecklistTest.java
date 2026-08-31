package com.bibbidi.wedding.checklist.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ChecklistTest {

    @Test
    @DisplayName("새 체크리스트는 식별자 없이 소유자만 정해진다")
    void shouldHaveOnlyOwnerWhenCreated() {
        // given, when
        Checklist checklist = new Checklist(null, 1L, List.of());

        // then
        assertThat(checklist)
                .extracting(Checklist::id, Checklist::ownerId)
                .containsExactly(null, 1L);
    }

    @Test
    @DisplayName("체크리스트는 자신의 할 일 목록을 가진다")
    void shouldHaveChecklistItems() {
        // given
        ChecklistItem item = item(10L);

        // when
        Checklist checklist = new Checklist(1L, 1L, List.of(item));

        // then
        assertThat(checklist.items()).containsExactly(item);
        assertThat(checklist.item(10L)).isEqualTo(item);
    }

    @Test
    @DisplayName("체크리스트의 소유자는 접근할 수 있다")
    void shouldAllowAccessByOwner() {
        // given
        Checklist checklist = new Checklist(1L, 1L, List.of(item(10L)));

        // when, then
        assertThatCode(() -> checklist.validateOwnedBy(1L))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("체크리스트의 소유자만 접근할 수 있다")
    void shouldRejectAccessByAnotherOwner() {
        // given
        Checklist checklist = new Checklist(1L, 1L, List.of(item(10L)));

        // when, then
        assertThatThrownBy(() -> checklist.validateOwnedBy(2L))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CHECKLIST_ITEM_ACCESS_DENIED);
    }

    @Test
    @DisplayName("체크리스트에 없는 할 일은 찾을 수 없다")
    void shouldRejectUnknownChecklistItem() {
        // given
        Checklist checklist = new Checklist(1L, 1L, List.of(item(10L)));

        // when, then
        assertThatThrownBy(() -> checklist.item(999L))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CHECKLIST_ITEM_NOT_FOUND);
    }

    private static ChecklistItem item(Long id) {
        return new ChecklistItem(
                id,
                2L,
                "계약서 확인",
                null,
                ChecklistItemStatus.PREV
        );
    }
}
