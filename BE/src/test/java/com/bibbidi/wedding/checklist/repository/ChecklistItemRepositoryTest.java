package com.bibbidi.wedding.checklist.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.checklist.domain.ChecklistItem;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@ActiveProfiles("test")
@Import({ChecklistItemRepository.class, ChecklistMapper.class})
class ChecklistItemRepositoryTest {

    private static final Long CHECKLIST_ID = 1000L;
    private static final Long CATEGORY_ID = 2L;

    @Autowired
    private ChecklistItemRepository checklistItemRepository;

    @Autowired
    private JpaChecklistRepository jpaChecklistRepository;

    private JpaChecklistEntity saveChecklist(Long ownerId) {
        return jpaChecklistRepository.saveAndFlush(new JpaChecklistEntity(null, ownerId));
    }

    private ChecklistItem saveItem(Long checklistId, Long sourceCatalogItemId) {
        return checklistItemRepository.save(new ChecklistItem(
                null,
                checklistId,
                CATEGORY_ID,
                "계약서 확인",
                sourceCatalogItemId,
                ChecklistItemStatus.PREV
        ));
    }

    @Test
    @DisplayName("할 일을 저장하고 생성된 식별자를 채워 반환한다")
    void shouldSaveChecklistItemAndReturnGeneratedId() {
        // when
        ChecklistItem saved = saveItem(CHECKLIST_ID, 100L);

        // then
        assertThat(saved.id()).isNotNull();
        assertThat(saved)
                .extracting(
                        ChecklistItem::checklistId,
                        ChecklistItem::categoryId,
                        ChecklistItem::title,
                        ChecklistItem::sourceCatalogItemId,
                        ChecklistItem::isDone
                )
                .containsExactly(CHECKLIST_ID, CATEGORY_ID, "계약서 확인", 100L, false);
    }

    @Test
    @DisplayName("식별자로 할 일을 조회하면 도메인으로 변환해 반환한다")
    void shouldFindChecklistItemById() {
        // given
        ChecklistItem saved = saveItem(CHECKLIST_ID, 100L);

        // when
        Optional<ChecklistItem> found = checklistItemRepository.findById(saved.id());

        // then
        assertThat(found)
                .get()
                .extracting(ChecklistItem::id, ChecklistItem::checklistId, ChecklistItem::title)
                .containsExactly(saved.id(), CHECKLIST_ID, "계약서 확인");
    }

    @Test
    @DisplayName("존재하지 않는 할 일을 조회하면 빈 결과를 반환한다")
    void shouldReturnEmptyWhenChecklistItemDoesNotExist() {
        // when, then
        assertThat(checklistItemRepository.findById(999L)).isEmpty();
    }

    @Test
    @DisplayName("할 일이 사용자의 체크리스트에 속하면 소유권을 인정한다")
    void shouldConfirmOwnershipWhenItemBelongsToOwner() {
        // given
        JpaChecklistEntity checklist = saveChecklist(1L);
        ChecklistItem saved = saveItem(checklist.id(), 100L);

        // when, then
        assertThat(checklistItemRepository.existsByIdAndOwnerId(saved.id(), 1L)).isTrue();
    }

    @Test
    @DisplayName("할 일이 다른 사용자의 체크리스트에 속하면 소유권을 인정하지 않는다")
    void shouldDenyOwnershipWhenItemBelongsToAnotherOwner() {
        // given
        saveChecklist(1L);
        JpaChecklistEntity checklist = saveChecklist(2L);
        ChecklistItem saved = saveItem(checklist.id(), 100L);

        // when, then
        assertThat(checklistItemRepository.existsByIdAndOwnerId(saved.id(), 1L)).isFalse();
    }

    @Test
    @DisplayName("할 일이 존재하지 않으면 소유권을 인정하지 않는다")
    void shouldDenyOwnershipWhenItemDoesNotExist() {
        // given
        saveChecklist(1L);

        // when, then
        assertThat(checklistItemRepository.existsByIdAndOwnerId(999L, 1L)).isFalse();
    }

    @Test
    @DisplayName("한 체크리스트에 속한 할 일만 조회한다")
    void shouldFindOnlyItemsOfGivenChecklist() {
        // given
        saveItem(CHECKLIST_ID, 100L);
        saveItem(CHECKLIST_ID, 101L);
        saveItem(2000L, 102L);

        // when, then
        assertThat(checklistItemRepository.findByChecklistId(CHECKLIST_ID))
                .extracting(ChecklistItem::sourceCatalogItemId)
                .containsExactly(100L, 101L);
        assertThat(checklistItemRepository.findByChecklistId(2000L))
                .extracting(ChecklistItem::sourceCatalogItemId)
                .containsExactly(102L);
    }

    @Test
    @DisplayName("여러 할 일을 한 번에 저장하고 생성된 식별자를 채워 반환한다")
    void shouldSaveAllItemsAndReturnGeneratedIds() {
        // given
        List<ChecklistItem> items = List.of(
                new ChecklistItem(null, CHECKLIST_ID, CATEGORY_ID, "계약서 확인", 100L, ChecklistItemStatus.PREV),
                new ChecklistItem(null, CHECKLIST_ID, CATEGORY_ID, "견적 비교", 101L, ChecklistItemStatus.PREV)
        );

        // when
        List<ChecklistItem> saved = checklistItemRepository.saveAll(items);

        // then
        assertThat(saved).hasSize(2).allSatisfy(item -> assertThat(item.id()).isNotNull());
        assertThat(checklistItemRepository.findByChecklistId(CHECKLIST_ID))
                .extracting(ChecklistItem::sourceCatalogItemId)
                .containsExactly(100L, 101L);
    }

    @Test
    @DisplayName("같은 체크리스트에 같은 준비 항목을 두 번 저장하면 UNIQUE 제약을 위반한다")
    void shouldViolateUniqueConstraintWhenSameCatalogItemSavedTwice() {
        // given
        saveItem(CHECKLIST_ID, 100L);

        // when, then
        assertThatThrownBy(() -> saveItem(CHECKLIST_ID, 100L))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("직접 만든 할 일은 원본 준비 항목이 없어 여러 번 저장할 수 있다")
    void shouldAllowMultipleItemsWithoutSourceCatalogItem() {
        // given
        saveItem(CHECKLIST_ID, null);

        // when
        saveItem(CHECKLIST_ID, null);

        // then
        assertThat(checklistItemRepository.findByChecklistId(CHECKLIST_ID)).hasSize(2);
    }
}
