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

    private static final Long OWNER_ID = 1L;
    private static final Long OTHER_OWNER_ID = 2L;
    private static final Long ITEM_ID = 10L;

    @Test
    @DisplayName("새 체크리스트는 식별자 없이 소유자만 정해진다")
    void shouldHaveOnlyOwnerWhenCreated() {
        // given, when
        Checklist checklist = new Checklist(null, OWNER_ID, List.of());

        // then
        assertThat(checklist)
                .extracting(Checklist::id, Checklist::ownerId)
                .containsExactly(null, OWNER_ID);
    }

    @Test
    @DisplayName("체크리스트는 자신의 할 일 목록을 가진다")
    void shouldHaveChecklistItems() {
        // given
        ChecklistItem item = item(ITEM_ID, null, ChecklistItemStatus.PREV);

        // when
        Checklist checklist = new Checklist(1L, OWNER_ID, List.of(item));

        // then
        assertThat(checklist.items()).containsExactly(item);
        assertThat(checklist.itemIds()).containsExactly(ITEM_ID);
    }

    @Test
    @DisplayName("체크리스트의 할 일 상태로 진행도를 계산한다")
    void shouldCalculateProgressFromChecklistItems() {
        Checklist checklist = new Checklist(
                1L,
                OWNER_ID,
                List.of(
                        item(1L, null, ChecklistItemStatus.DONE),
                        item(2L, null, ChecklistItemStatus.PREV),
                        item(3L, null, ChecklistItemStatus.CONTINUE)
                )
        );

        ChecklistProgress progress = checklist.calculateProgress();

        assertThat(progress)
                .extracting(
                        ChecklistProgress::totalCount,
                        ChecklistProgress::doneCount,
                        ChecklistProgress::remainingCount,
                        ChecklistProgress::percentage,
                        ChecklistProgress::allDone
                )
                .containsExactly(3, 1, 2, 33, false);
    }

    @Test
    @DisplayName("체크리스트의 소유자는 접근할 수 있다")
    void shouldAllowAccessByOwner() {
        // given
        Checklist checklist = checklist(OWNER_ID, null, ChecklistItemStatus.PREV);

        // when, then
        assertThatCode(() -> checklist.validateOwnedBy(OWNER_ID))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("체크리스트의 소유자만 접근할 수 있다")
    void shouldRejectAccessByAnotherOwner() {
        // given
        Checklist checklist = checklist(OWNER_ID, null, ChecklistItemStatus.PREV);

        // when, then
        assertThatThrownBy(() -> checklist.validateOwnedBy(OTHER_OWNER_ID))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CHECKLIST_ITEM_ACCESS_DENIED);
    }

    @Test
    @DisplayName("소유자가 요청하면 할 일의 카테고리를 바꾼 결과를 돌려준다")
    void shouldChangeItemCategory() {
        // given
        Checklist checklist = checklist(OWNER_ID, null, ChecklistItemStatus.PREV);

        // when
        ChecklistItem changed = checklist.changeItemCategory(OWNER_ID, ITEM_ID, 20L);

        // then
        assertThat(changed)
                .extracting(ChecklistItem::id, ChecklistItem::categoryId)
                .containsExactly(ITEM_ID, 20L);
    }

    @Test
    @DisplayName("다른 사용자는 할 일의 카테고리를 바꿀 수 없다")
    void shouldRejectItemCategoryChangeByAnotherOwner() {
        // given
        Checklist checklist = checklist(OWNER_ID, null, ChecklistItemStatus.PREV);

        // when, then
        assertThatThrownBy(() -> checklist.changeItemCategory(OTHER_OWNER_ID, ITEM_ID, 20L))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CHECKLIST_ITEM_ACCESS_DENIED);
    }

    @Test
    @DisplayName("준비 목록에서 가져온 할 일은 카테고리를 바꿀 수 없다")
    void shouldRejectItemCategoryChangeWhenItemCameFromCatalog() {
        // given
        Checklist checklist = checklist(OWNER_ID, 100L, ChecklistItemStatus.PREV);

        // when, then
        assertThatThrownBy(() -> checklist.changeItemCategory(OWNER_ID, ITEM_ID, 20L))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CHECKLIST_ITEM_CATEGORY_NOT_CHANGEABLE);
    }

    @Test
    @DisplayName("소유자가 요청하면 할 일의 제목을 바꾼 결과를 돌려준다")
    void shouldChangeItemTitle() {
        // given
        Checklist checklist = checklist(OWNER_ID, null, ChecklistItemStatus.PREV);

        // when
        ChecklistItem changed = checklist.changeItemTitle(OWNER_ID, ITEM_ID, "청첩장 문구 정하기");

        // then
        assertThat(changed)
                .extracting(ChecklistItem::id, ChecklistItem::title)
                .containsExactly(ITEM_ID, "청첩장 문구 정하기");
    }

    @Test
    @DisplayName("다른 사용자는 할 일의 제목을 바꿀 수 없다")
    void shouldRejectItemTitleChangeByAnotherOwner() {
        // given
        Checklist checklist = checklist(OWNER_ID, null, ChecklistItemStatus.PREV);

        // when, then
        assertThatThrownBy(() -> checklist.changeItemTitle(OTHER_OWNER_ID, ITEM_ID, "청첩장 문구 정하기"))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CHECKLIST_ITEM_ACCESS_DENIED);
    }

    @Test
    @DisplayName("체크리스트에 없는 할 일은 찾을 수 없다")
    void shouldRejectUnknownChecklistItem() {
        // given
        Checklist checklist = checklist(OWNER_ID, null, ChecklistItemStatus.PREV);

        // when, then
        assertThatThrownBy(() -> checklist.changeItemTitle(OWNER_ID, 999L, "청첩장 문구 정하기"))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CHECKLIST_ITEM_NOT_FOUND);
    }

    @Test
    @DisplayName("소유자의 미완료 할 일은 삭제할 수 있다")
    void shouldReturnDeletableItem() {
        // given
        Checklist checklist = checklist(OWNER_ID, null, ChecklistItemStatus.PREV);

        // when
        ChecklistItem item = checklist.deletableItem(OWNER_ID, ITEM_ID);

        // then
        assertThat(item.id()).isEqualTo(ITEM_ID);
    }

    @Test
    @DisplayName("다른 사용자의 할 일은 삭제할 수 없다")
    void shouldRejectDeletableItemForAnotherOwner() {
        // given
        Checklist checklist = checklist(OWNER_ID, null, ChecklistItemStatus.PREV);

        // when, then
        assertThatThrownBy(() -> checklist.deletableItem(OTHER_OWNER_ID, ITEM_ID))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CHECKLIST_ITEM_ACCESS_DENIED);
    }

    @Test
    @DisplayName("완료된 할 일은 삭제할 수 없다")
    void shouldRejectDeletableItemWhenItemIsDone() {
        // given
        Checklist checklist = checklist(OWNER_ID, null, ChecklistItemStatus.DONE);

        // when, then
        assertThatThrownBy(() -> checklist.deletableItem(OWNER_ID, ITEM_ID))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.COMPLETED_CHECKLIST_ITEM_NOT_DELETABLE);
    }

    private static Checklist checklist(Long ownerId, Long sourceCatalogItemId, ChecklistItemStatus status) {
        return new Checklist(1L, ownerId, List.of(item(ITEM_ID, sourceCatalogItemId, status)));
    }

    private static ChecklistItem item(Long id, Long sourceCatalogItemId, ChecklistItemStatus status) {
        return new ChecklistItem(
                id,
                2L,
                "계약서 확인",
                sourceCatalogItemId,
                status
        );
    }
}
