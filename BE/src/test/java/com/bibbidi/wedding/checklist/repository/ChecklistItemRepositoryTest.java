package com.bibbidi.wedding.checklist.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.domain.ChecklistItem;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
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

    private static final Long OWNER_ID = 1L;
    private static final Long OTHER_OWNER_ID = 2L;
    private static final Long CATEGORY_ID = 2L;

    @Autowired
    private ChecklistItemRepository checklistItemRepository;

    @Autowired
    private JpaChecklistRepository jpaChecklistRepository;

    private Checklist checklist;

    @BeforeEach
    void setUp() {
        checklist = saveChecklist(OWNER_ID);
    }

    private Checklist saveChecklist(Long ownerId) {
        JpaChecklistEntity saved = jpaChecklistRepository.saveAndFlush(new JpaChecklistEntity(null, ownerId));

        return new Checklist(saved.id(), saved.ownerId());
    }

    private ChecklistItem saveItem(Checklist owner, Long sourceCatalogItemId) {
        return checklistItemRepository.save(new ChecklistItem(
                null,
                owner,
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
        ChecklistItem saved = saveItem(checklist, 100L);

        // then
        assertThat(saved.id()).isNotNull();
        assertThat(saved)
                .extracting(
                        item -> item.checklist().id(),
                        ChecklistItem::categoryId,
                        ChecklistItem::title,
                        ChecklistItem::sourceCatalogItemId,
                        ChecklistItem::isDone
                )
                .containsExactly(checklist.id(), CATEGORY_ID, "계약서 확인", 100L, false);
    }

    @Test
    @DisplayName("식별자로 할 일을 조회하면 체크리스트까지 채운 도메인으로 변환해 반환한다")
    void shouldFindChecklistItemById() {
        // given
        ChecklistItem saved = saveItem(checklist, 100L);

        // when
        Optional<ChecklistItem> found = checklistItemRepository.findById(saved.id());

        // then
        assertThat(found)
                .get()
                .extracting(
                        ChecklistItem::id,
                        item -> item.checklist().id(),
                        item -> item.checklist().ownerId(),
                        ChecklistItem::title
                )
                .containsExactly(saved.id(), checklist.id(), OWNER_ID, "계약서 확인");
    }

    @Test
    @DisplayName("존재하지 않는 할 일을 조회하면 빈 결과를 반환한다")
    void shouldReturnEmptyWhenChecklistItemDoesNotExist() {
        // when, then
        assertThat(checklistItemRepository.findById(999L)).isEmpty();
    }

    @Test
    @DisplayName("다른 사용자의 체크리스트에 속한 할 일은 그 사용자를 소유자로 답한다")
    void shouldAnswerOwnerOfItemBelongingToAnotherChecklist() {
        // given
        ChecklistItem saved = saveItem(saveChecklist(OTHER_OWNER_ID), 100L);

        // when
        Optional<ChecklistItem> found = checklistItemRepository.findById(saved.id());

        // then
        assertThat(found).get().satisfies(item -> {
            assertThat(item.isOwnedBy(OTHER_OWNER_ID)).isTrue();
            assertThat(item.isOwnedBy(OWNER_ID)).isFalse();
        });
    }

    @Test
    @DisplayName("한 체크리스트에 속한 할 일만 조회한다")
    void shouldFindOnlyItemsOfGivenChecklist() {
        // given
        Checklist otherChecklist = saveChecklist(OTHER_OWNER_ID);
        saveItem(checklist, 100L);
        saveItem(checklist, 101L);
        saveItem(otherChecklist, 102L);

        // when, then
        assertThat(checklistItemRepository.findByChecklistId(checklist.id()))
                .extracting(ChecklistItem::sourceCatalogItemId)
                .containsExactly(100L, 101L);
        assertThat(checklistItemRepository.findByChecklistId(otherChecklist.id()))
                .extracting(ChecklistItem::sourceCatalogItemId)
                .containsExactly(102L);
    }

    @Test
    @DisplayName("여러 할 일을 한 번에 저장하고 생성된 식별자를 채워 반환한다")
    void shouldSaveAllItemsAndReturnGeneratedIds() {
        // given
        List<ChecklistItem> items = List.of(
                new ChecklistItem(null, checklist, CATEGORY_ID, "계약서 확인", 100L, ChecklistItemStatus.PREV),
                new ChecklistItem(null, checklist, CATEGORY_ID, "견적 비교", 101L, ChecklistItemStatus.PREV)
        );

        // when
        List<ChecklistItem> saved = checklistItemRepository.saveAll(items);

        // then
        assertThat(saved).hasSize(2).allSatisfy(item -> assertThat(item.id()).isNotNull());
        assertThat(checklistItemRepository.findByChecklistId(checklist.id()))
                .extracting(ChecklistItem::sourceCatalogItemId)
                .containsExactly(100L, 101L);
    }

    @Test
    @DisplayName("같은 체크리스트에 같은 준비 항목을 두 번 저장하면 UNIQUE 제약을 위반한다")
    void shouldViolateUniqueConstraintWhenSameCatalogItemSavedTwice() {
        // given
        saveItem(checklist, 100L);

        // when, then
        assertThatThrownBy(() -> saveItem(checklist, 100L))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("직접 만든 할 일은 원본 준비 항목이 없어 여러 번 저장할 수 있다")
    void shouldAllowMultipleItemsWithoutSourceCatalogItem() {
        // given
        saveItem(checklist, null);

        // when
        saveItem(checklist, null);

        // then
        assertThat(checklistItemRepository.findByChecklistId(checklist.id())).hasSize(2);
    }
}
