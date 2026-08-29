package com.bibbidi.wedding.checklist.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ChecklistItemTest {

    private static final Checklist CHECKLIST = new Checklist(100L, 1L);

    private static ChecklistItem constructTestItem() {
        return new ChecklistItem(
                1L,
                CHECKLIST,
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
                        extracted -> extracted.checklist().id(),
                        ChecklistItem::categoryId,
                        ChecklistItem::title,
                        ChecklistItem::sourceCatalogItemId
                )
                .containsExactly(
                        item.id(),
                        item.checklist().id(),
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
                CHECKLIST,
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
                        extracted -> extracted.checklist().id(),
                        ChecklistItem::categoryId,
                        ChecklistItem::title,
                        ChecklistItem::sourceCatalogItemId,
                        ChecklistItem::status
                )
                .containsExactly(
                        item.id(),
                        item.checklist().id(),
                        20L,
                        item.title(),
                        item.sourceCatalogItemId(),
                        item.status()
                );
    }

    @Test
    @DisplayName("체크리스트의 주인이 곧 할 일의 주인이다")
    void shouldBeOwnedByChecklistOwner() {
        // given
        ChecklistItem item = constructTestItem();

        // when, then
        assertThat(item.isOwnedBy(1L)).isTrue();
        assertThat(item.isOwnedBy(2L)).isFalse();
    }

    @Test
    @DisplayName("준비 목록에서 추가한 할 일은 카테고리를 변경할 수 없다")
    void shouldRejectCategoryChangeWhenAddedFromCatalog() {
        // given
        ChecklistItem item = constructTestItem();

        // when, then
        assertThatThrownBy(() -> item.changeCategory(20L))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CHECKLIST_ITEM_CATEGORY_NOT_CHANGEABLE);
    }

    @Test
    @DisplayName("원본 준비 항목과의 연결이 끊긴 할 일은 카테고리를 변경할 수 있다")
    void shouldAllowCategoryChangeWhenSourceCatalogItemIsGone() {
        // given
        ChecklistItem item = new ChecklistItem(
                1L,
                CHECKLIST,
                10L,
                "Wedding hall consultation",
                null,
                ChecklistItemStatus.PREV
        );

        // when
        ChecklistItem changed = item.changeCategory(20L);

        // then
        assertThat(changed.categoryId()).isEqualTo(20L);
    }
}
