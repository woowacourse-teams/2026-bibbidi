package com.bibbidi.wedding.checklist.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.checklist.domain.ChecklistItem;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@ActiveProfiles("test")
@Import({ChecklistItemRepository.class, ChecklistMapper.class})
class ChecklistItemRepositoryTest {

    private static final Long CHECKLIST_ID = 1000L;
    private static final Long CATEGORY_ID = 2L;

    @Autowired
    private ChecklistItemRepository checklistItemRepository;

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
}
