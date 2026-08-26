package com.bibbidi.wedding.checklist.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNullPointerException;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CatalogItemTest {

    @Test
    @DisplayName("새로 만든 카탈로그 항목은 아직 저장되지 않아 식별자를 갖지 않는다")
    void shouldHaveNoIdWhenCreated() {
        CatalogItem catalogItem = CatalogItem.create(1L, "스튜디오 촬영", "드레스 투어 이후 진행한다");

        assertThat(catalogItem.id()).isNull();
        assertThat(catalogItem.categoryId()).isEqualTo(1L);
        assertThat(catalogItem.title()).isEqualTo("스튜디오 촬영");
        assertThat(catalogItem.description()).isEqualTo("드레스 투어 이후 진행한다");
    }

    @Test
    @DisplayName("설명은 비어 있을 수 있다")
    void shouldAllowNullDescriptionWhenCreated() {
        CatalogItem catalogItem = CatalogItem.create(1L, "스튜디오 촬영", null);

        assertThat(catalogItem.description()).isNull();
    }

    @Test
    @DisplayName("카테고리와 제목이 없으면 카탈로그 항목을 만들 수 없다")
    void shouldRejectWhenCategoryIdOrTitleIsMissing() {
        assertThatNullPointerException()
                .isThrownBy(() -> CatalogItem.create(null, "스튜디오 촬영", null));
        assertThatNullPointerException()
                .isThrownBy(() -> CatalogItem.create(1L, null, null));
    }

    @Test
    @DisplayName("식별자가 없으면 저장된 카탈로그 항목으로 복원할 수 없다")
    void shouldRejectWhenRestoredWithoutId() {
        assertThatNullPointerException()
                .isThrownBy(() -> CatalogItem.restore(null, 1L, "스튜디오 촬영", null));
    }
}
