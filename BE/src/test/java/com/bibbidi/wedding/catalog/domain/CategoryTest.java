package com.bibbidi.wedding.catalog.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CategoryTest {

    private static final Item FIRST_ITEM = new Item(1L, "첫 번째 할 일", 1, true);
    private static final Item SECOND_ITEM = new Item(2L, "두 번째 할 일", 2, false);
    private static final Item THIRD_ITEM = new Item(3L, "세 번째 할 일", 1, false);

    @Test
    @DisplayName("여러 단계에 걸쳐 있어도 선택한 준비 항목만 찾는다")
    void shouldFindSelectedItemsAcrossSteps() {
        // given
        Step firstStep = new Step(1L, "첫 번째 단계", null, 1, List.of(FIRST_ITEM, SECOND_ITEM));
        Step secondStep = new Step(2L, "두 번째 단계", null, 2, List.of(THIRD_ITEM));
        Category category = new Category(10L, "웨딩홀", 1, List.of(firstStep, secondStep));

        // when
        List<Item> items = category.findItems(List.of(SECOND_ITEM.id(), THIRD_ITEM.id()));

        // then
        assertThat(items)
                .extracting(Item::id)
                .containsExactly(SECOND_ITEM.id(), THIRD_ITEM.id());
    }

    @Test
    @DisplayName("영역에 없는 ID는 조회 결과에 포함하지 않는다")
    void shouldNotFindUnknownItem() {
        // given
        Step step = new Step(1L, "첫 번째 단계", null, 1, List.of(FIRST_ITEM));
        Category category = new Category(10L, "웨딩홀", 1, List.of(step));

        // when, then
        assertThat(category.findItems(List.of(999L))).isEmpty();
    }
}
