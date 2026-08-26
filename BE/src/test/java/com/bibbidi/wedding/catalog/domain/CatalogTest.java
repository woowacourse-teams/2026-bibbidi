package com.bibbidi.wedding.catalog.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CatalogTest {

    private static final Item FIRST_ITEM = new Item(1L, "첫 번째 할 일", 1, true);
    private static final Item SECOND_ITEM = new Item(2L, "두 번째 할 일", 2, false);

    @Test
    @DisplayName("준비 영역과 단계와 항목을 모두 노출 순서대로 정렬한다")
    void shouldSortEveryLevelByDisplayOrder() {
        // given
        Step firstStep = new Step(1L, "첫 번째 단계", "단계 설명", 1, List.of(SECOND_ITEM, FIRST_ITEM));
        Step secondStep = new Step(2L, "두 번째 단계", null, 2, List.of());
        Category firstCategory = new Category(1L, "첫 번째 영역", 1, List.of(secondStep, firstStep));
        Category secondCategory = new Category(2L, "두 번째 영역", 2, List.of());

        // when
        Catalog catalog = new Catalog(List.of(secondCategory, firstCategory));

        // then
        assertThat(catalog.categories()).extracting(Category::id).containsExactly(1L, 2L);
        assertThat(catalog.categories().getFirst().steps())
                .extracting(Step::id)
                .containsExactly(1L, 2L);
        assertThat(catalog.categories().getFirst().steps().getFirst().items())
                .extracting(Item::id)
                .containsExactly(1L, 2L);
    }
}
