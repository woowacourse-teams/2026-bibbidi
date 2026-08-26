package com.bibbidi.wedding.checklist.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNullPointerException;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ChecklistItemTest {

    private static final Long CHECKLIST_ID = 100L;

    @Test
    @DisplayName("카탈로그 항목에서 파생한 체크리스트 항목은 카테고리와 제목을 물려받고 미완료로 시작한다")
    void shouldInheritCategoryAndTitleWhenDerivedFromCatalogItem() {
        CatalogItem catalogItem = CatalogItem.restore(1L, 10L, "스튜디오 촬영", "드레스 투어 이후 진행한다");

        ChecklistItem checklistItem = catalogItem.toChecklistItem(CHECKLIST_ID);

        assertThat(checklistItem.id()).isNull();
        assertThat(checklistItem.checklistId()).isEqualTo(CHECKLIST_ID);
        assertThat(checklistItem.categoryId()).isEqualTo(10L);
        assertThat(checklistItem.title()).isEqualTo("스튜디오 촬영");
        assertThat(checklistItem.isDone()).isFalse();
    }

    @Test
    @DisplayName("파생한 체크리스트 항목은 어떤 카탈로그 항목에서 왔는지 기억한다")
    void shouldRememberSourceWhenDerivedFromCatalogItem() {
        CatalogItem catalogItem = CatalogItem.restore(1L, 10L, "스튜디오 촬영", null);

        ChecklistItem checklistItem = catalogItem.toChecklistItem(CHECKLIST_ID);

        assertThat(checklistItem.sourceCatalogItemId()).isEqualTo(1L);
        assertThat(checklistItem.cameFrom(1L)).isTrue();
        assertThat(checklistItem.cameFrom(2L)).isFalse();
    }

    @Test
    @DisplayName("저장되지 않은 카탈로그 항목에서는 체크리스트 항목을 파생할 수 없다")
    void shouldRejectWhenDerivedFromUnsavedCatalogItem() {
        CatalogItem catalogItem = CatalogItem.create(10L, "스튜디오 촬영", null);

        assertThatNullPointerException()
                .isThrownBy(() -> catalogItem.toChecklistItem(CHECKLIST_ID));
    }

    @Test
    @DisplayName("직접 추가한 항목은 출처가 없어 어떤 카탈로그 항목에서도 왔다고 보지 않는다")
    void shouldNotComeFromAnyCatalogItemWhenSourceIsAbsent() {
        ChecklistItem checklistItem =
                ChecklistItem.restore(1L, CHECKLIST_ID, 10L, "부모님 상견례", null, false);

        assertThat(checklistItem.sourceCatalogItemId()).isNull();
        assertThat(checklistItem.cameFrom(1L)).isFalse();
        assertThat(checklistItem.cameFrom(null)).isFalse();
    }

    @Test
    @DisplayName("항목을 완료하면 완료 상태가 되고 되돌리면 미완료로 돌아온다")
    void shouldToggleDoneWhenCompletedAndReopened() {
        CatalogItem catalogItem = CatalogItem.restore(1L, 10L, "스튜디오 촬영", null);
        ChecklistItem checklistItem = catalogItem.toChecklistItem(CHECKLIST_ID);

        checklistItem.complete();
        assertThat(checklistItem.isDone()).isTrue();

        checklistItem.reopen();
        assertThat(checklistItem.isDone()).isFalse();
    }

    @Test
    @DisplayName("소속 체크리스트와 카테고리와 제목이 없으면 체크리스트 항목을 만들 수 없다")
    void shouldRejectWhenRequiredFieldsAreMissing() {
        assertThatNullPointerException()
                .isThrownBy(() -> ChecklistItem.restore(1L, null, 10L, "상견례", null, false));
        assertThatNullPointerException()
                .isThrownBy(() -> ChecklistItem.restore(1L, CHECKLIST_ID, null, "상견례", null, false));
        assertThatNullPointerException()
                .isThrownBy(() -> ChecklistItem.restore(1L, CHECKLIST_ID, 10L, null, null, false));
    }

    @Test
    @DisplayName("식별자가 없으면 저장된 체크리스트 항목으로 복원할 수 없다")
    void shouldRejectWhenRestoredWithoutId() {
        assertThatNullPointerException()
                .isThrownBy(() -> ChecklistItem.restore(null, CHECKLIST_ID, 10L, "상견례", null, false));
    }
}
