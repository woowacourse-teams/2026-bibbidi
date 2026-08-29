package com.bibbidi.wedding.checklist.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ChecklistItemTest {

    private static ChecklistItem constructTestItem() {
        return new ChecklistItem(
                1L,
                100L,
                10L,
                "Wedding hall consultation",
                1L,
                ChecklistItemStatus.PREV
        );
    }

    @Test
    @DisplayName("생성된 체크리스트 항목은 `시작 전` 상태다")
    void shouldHaveBeforeStatusWhenCreated() {
        // given
        ChecklistItem item = constructTestItem();

        // when
        ChecklistItemStatus status = item.status();

        // then
        assertThat(status).isEqualTo(ChecklistItemStatus.PREV);
    }

    @Test
    @DisplayName("진행을 시작하면 `진행 중` 상태가 된다")
    void shouldHaveContinueStatusWhenOnProgress() {
        // given
        ChecklistItem item = constructTestItem();

        // when
        ChecklistItem progressed = item.onProgress();

        // then
        assertThat(progressed.status()).isEqualTo(ChecklistItemStatus.CONTINUE);
    }

    @Test
    @DisplayName("완료하면 `완료 상태`가 된다")
    void shouldHaveDoneStatusWhenCompleted() {
        // given
        ChecklistItem item = constructTestItem();

        // when
        ChecklistItem completed = item.complete();

        // then
        assertThat(completed.status()).isEqualTo(ChecklistItemStatus.DONE);
    }

    @Test
    @DisplayName("reset()하면 `시작 전` 상태로 돌아간다")
    void shouldReturnToBeforeStatusWhenReset() {
        // given
        ChecklistItem item = constructTestItem().complete();

        // when
        item = item.reset();

        // then
        assertThat(item.status()).isEqualTo(ChecklistItemStatus.PREV);
    }

    @Test
    @DisplayName("상태를 변경해도 체크리스트 항목 정보는 유지된다")
    void shouldKeepChecklistInformationWhenStatusChanges() {
        // given
        ChecklistItem item = constructTestItem();

        // when
        ChecklistItem progressed = item.onProgress();

        // then
        assertThat(progressed)
                .extracting(
                        ChecklistItem::id,
                        ChecklistItem::checklistId,
                        ChecklistItem::categoryId,
                        ChecklistItem::title,
                        ChecklistItem::sourceCatalogItemId
                )
                .containsExactly(
                        item.id(),
                        item.checklistId(),
                        item.categoryId(),
                        item.title(),
                        item.sourceCatalogItemId()
                );
    }

    @Test
    @DisplayName("카탈로그 항목 ID가 같으면 원본 항목으로 식별한다")
    void shouldIdentifySourceCatalogItemWhenIdsMatch() {
        // given
        ChecklistItem item = constructTestItem();

        // when
        boolean cameFrom = item.cameFrom(1L);

        // then
        assertThat(cameFrom).isTrue();
    }

    @Test
    @DisplayName("다른 카탈로그 항목 ID는 원본 항목으로 식별하지 않는다")
    void shouldNotIdentifyOtherCatalogItemAsSource() {
        // given
        ChecklistItem item = constructTestItem();

        // when
        boolean cameFrom = item.cameFrom(2L);

        // then
        assertThat(cameFrom).isFalse();
    }

    @Test
    @DisplayName("카테고리를 변경해도 제목과 완료 상태는 그대로다")
    void shouldKeepOtherInformationWhenCategoryChanges() {
        // given
        ChecklistItem item = new ChecklistItem(
                1L,
                100L,
                10L,
                "Wedding hall consultation",
                null,
                ChecklistItemStatus.DONE
        );

        // when
        ChecklistItem changed = item.changeCategory(20L);

        // then
        assertThat(changed)
                .extracting(
                        ChecklistItem::id,
                        ChecklistItem::checklistId,
                        ChecklistItem::categoryId,
                        ChecklistItem::title,
                        ChecklistItem::sourceCatalogItemId,
                        ChecklistItem::status
                )
                .containsExactly(
                        item.id(),
                        item.checklistId(),
                        20L,
                        item.title(),
                        item.sourceCatalogItemId(),
                        item.status()
                );
    }

    @Test
    @DisplayName("준비 목록에서 추가한 할 일은 원본 준비 항목을 가지고 있다")
    void shouldHaveSourceCatalogItemWhenAddedFromCatalog() {
        // given
        ChecklistItem item = constructTestItem();

        // when
        boolean hasSourceCatalogItem = item.hasSourceCatalogItem();

        // then
        assertThat(hasSourceCatalogItem).isTrue();
    }

    @Test
    @DisplayName("직접 만든 할 일은 원본 준비 항목을 가지고 있지 않다")
    void shouldNotHaveSourceCatalogItemWhenCreatedDirectly() {
        // given
        ChecklistItem item = new ChecklistItem(
                1L,
                100L,
                10L,
                "Wedding hall consultation",
                null,
                ChecklistItemStatus.PREV
        );

        // when
        boolean hasSourceCatalogItem = item.hasSourceCatalogItem();

        // then
        assertThat(hasSourceCatalogItem).isFalse();
    }
}
