package com.bibbidi.wedding.checklist.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CatalogItemTest {

    private static final Long CATEGORY_ID = 10L;

    @Test
    @DisplayName("새로 만든 준비 항목은 아직 저장되지 않아 식별자를 갖지 않는다")
    void shouldHaveNoIdWhenCreated() {
        // given
        String title = "스튜디오 촬영";
        String description = "드레스 투어 이후 진행한다";

        // when
        CatalogItem catalogItem = CatalogItem.create(CATEGORY_ID, title, description);

        // then
        assertThat(catalogItem)
                .extracting(
                        CatalogItem::id,
                        CatalogItem::categoryId,
                        CatalogItem::title,
                        CatalogItem::description
                )
                .containsExactly(null, CATEGORY_ID, "스튜디오 촬영", "드레스 투어 이후 진행한다");
    }

    @Test
    @DisplayName("저장된 준비 항목을 복원하면 식별자를 그대로 갖는다")
    void shouldKeepIdWhenRestored() {
        // given
        Long id = 1L;

        // when
        CatalogItem catalogItem = CatalogItem.restore(id, CATEGORY_ID, "스튜디오 촬영", null);

        // then
        assertThat(catalogItem)
                .extracting(
                        CatalogItem::id,
                        CatalogItem::categoryId,
                        CatalogItem::title,
                        CatalogItem::description
                )
                .containsExactly(1L, CATEGORY_ID, "스튜디오 촬영", null);
    }
}
