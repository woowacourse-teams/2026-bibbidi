package com.bibbidi.wedding.checklist.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ChecklistItemTest {

    private static final Long CHECKLIST_ID = 100L;
    private static final Long CATALOG_ITEM_ID = 1L;
    private static final Long CATEGORY_ID = 10L;

    @Test
    @DisplayName("준비 항목에서 파생한 할 일은 카테고리와 제목을 물려받고 미완료로 시작한다")
    void shouldInheritCategoryAndTitleWhenDerivedFromCatalogItem() {
        // given
        CatalogItem catalogItem =
                CatalogItem.restore(CATALOG_ITEM_ID, CATEGORY_ID, "스튜디오 촬영", "드레스 투어 이후 진행한다");

        // when
        ChecklistItem checklistItem = catalogItem.toChecklistItem(CHECKLIST_ID);

        // then
        assertThat(checklistItem)
                .extracting(
                        ChecklistItem::id,
                        ChecklistItem::checklistId,
                        ChecklistItem::categoryId,
                        ChecklistItem::title,
                        ChecklistItem::sourceCatalogItemId,
                        ChecklistItem::isDone
                )
                .containsExactly(null, CHECKLIST_ID, CATEGORY_ID, "스튜디오 촬영", CATALOG_ITEM_ID, false);
    }

    @Test
    @DisplayName("파생한 할 일은 자신이 온 준비 항목을 출처로 인정한다")
    void shouldComeFromSourceCatalogItemWhenDerived() {
        // given
        CatalogItem catalogItem = CatalogItem.restore(CATALOG_ITEM_ID, CATEGORY_ID, "스튜디오 촬영", null);
        ChecklistItem checklistItem = catalogItem.toChecklistItem(CHECKLIST_ID);

        // when
        boolean cameFrom = checklistItem.cameFrom(CATALOG_ITEM_ID);

        // then
        assertThat(cameFrom).isTrue();
    }

    @Test
    @DisplayName("파생한 할 일은 다른 준비 항목을 출처로 인정하지 않는다")
    void shouldNotComeFromOtherCatalogItemWhenDerived() {
        // given
        CatalogItem catalogItem = CatalogItem.restore(CATALOG_ITEM_ID, CATEGORY_ID, "스튜디오 촬영", null);
        ChecklistItem checklistItem = catalogItem.toChecklistItem(CHECKLIST_ID);

        // when
        boolean cameFrom = checklistItem.cameFrom(2L);

        // then
        assertThat(cameFrom).isFalse();
    }

    @Test
    @DisplayName("직접 만든 할 일은 출처가 없어 어떤 준비 항목도 출처로 인정하지 않는다")
    void shouldNotComeFromAnyCatalogItemWhenSourceIsAbsent() {
        // given
        ChecklistItem checklistItem =
                ChecklistItem.restore(1L, CHECKLIST_ID, CATEGORY_ID, "부모님 상견례", null, false);

        // when
        boolean cameFrom = checklistItem.cameFrom(CATALOG_ITEM_ID);

        // then
        assertThat(cameFrom).isFalse();
    }

    @Test
    @DisplayName("미완료 할 일을 완료하면 완료 상태가 된다")
    void shouldBeDoneWhenCompleted() {
        // given
        ChecklistItem checklistItem =
                ChecklistItem.restore(1L, CHECKLIST_ID, CATEGORY_ID, "부모님 상견례", null, false);

        // when
        checklistItem.complete();

        // then
        assertThat(checklistItem.isDone()).isTrue();
    }

    @Test
    @DisplayName("완료한 할 일을 되돌리면 미완료 상태가 된다")
    void shouldNotBeDoneWhenReopened() {
        // given
        ChecklistItem checklistItem =
                ChecklistItem.restore(1L, CHECKLIST_ID, CATEGORY_ID, "부모님 상견례", null, true);

        // when
        checklistItem.reopen();

        // then
        assertThat(checklistItem.isDone()).isFalse();
    }
}
