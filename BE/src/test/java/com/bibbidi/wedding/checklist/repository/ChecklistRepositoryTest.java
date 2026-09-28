package com.bibbidi.wedding.checklist.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.domain.ChecklistItem;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemRepository;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistRepository;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@ActiveProfiles("test")
@Import({ChecklistRepository.class, ChecklistMapper.class})
class ChecklistRepositoryTest {

    private static final Long OWNER_ID = 1L;
    private static final Long OTHER_OWNER_ID = 2L;
    private static final Long CATEGORY_ID = 2L;

    @Autowired
    private ChecklistRepository checklistRepository;

    @Autowired
    private JpaChecklistRepository jpaChecklistRepository;

    @Autowired
    private JpaChecklistItemRepository jpaChecklistItemRepository;

    @Test
    @DisplayName("빈 체크리스트를 저장하고 생성된 식별자를 채워 반환한다")
    void shouldSaveChecklistAndReturnGeneratedId() {
        // given
        Checklist checklist = new Checklist(null, OWNER_ID, List.of());

        // when
        Checklist saved = checklistRepository.save(checklist);

        // then
        assertThat(saved.id()).isNotNull();
        assertThat(saved.ownerId()).isEqualTo(OWNER_ID);
        assertThat(jpaChecklistRepository.findAll())
                .singleElement()
                .extracting(JpaChecklistEntity::ownerId)
                .isEqualTo(OWNER_ID);
    }

    @Test
    @DisplayName("소유자의 체크리스트가 이미 있으면 중복 체크리스트 오류를 던진다")
    void shouldRejectSaveWhenOwnerAlreadyHasChecklist() {
        // given
        checklistRepository.save(new Checklist(null, OWNER_ID, List.of()));

        // when, then
        assertThatThrownBy(() -> checklistRepository.save(new Checklist(null, OWNER_ID, List.of())))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.DUPLICATE_CHECKLIST);
        assertThat(jpaChecklistRepository.findAll()).hasSize(1);
    }

    @Test
    @DisplayName("소유자의 체크리스트를 조회하면 도메인으로 변환해 반환한다")
    void shouldFindChecklistByOwnerId() {
        // given
        Checklist saved = saveChecklist(OWNER_ID);

        // when
        Optional<Checklist> found = checklistRepository.findByOwnerId(OWNER_ID);

        // then
        assertThat(found)
                .get()
                .extracting(Checklist::id, Checklist::ownerId)
                .containsExactly(saved.id(), OWNER_ID);
    }

    @Test
    @DisplayName("소유자의 체크리스트를 조회하면 할 일 목록까지 조립한다")
    void shouldAssembleChecklistItems() {
        // given
        Checklist checklist = saveChecklist(OWNER_ID);
        ChecklistItem item = saveItem(checklist, null);

        // when
        Checklist found = checklistRepository.getByOwnerId(OWNER_ID);

        // then
        assertThat(found.items())
                .singleElement()
                .extracting(ChecklistItem::id, ChecklistItem::title)
                .containsExactly(item.id(), "계약서 확인");
    }

    @Test
    @DisplayName("할 일 식별자로 체크리스트를 조회하면 같은 체크리스트의 할 일 목록까지 조립한다")
    void shouldFindAssembledChecklistByChecklistItemId() {
        // given
        Checklist checklist = saveChecklist(OWNER_ID);
        ChecklistItem item = saveItem(checklist, null);

        // when
        Checklist found = checklistRepository.getByChecklistItemId(item.id());

        // then
        assertThat(found.id()).isEqualTo(checklist.id());
        assertThat(found.items())
                .singleElement()
                .extracting(ChecklistItem::id)
                .isEqualTo(item.id());
    }

    @Test
    @DisplayName("소유자의 체크리스트가 없으면 빈 결과를 반환한다")
    void shouldReturnEmptyWhenOwnerHasNoChecklist() {
        // when, then
        assertThat(checklistRepository.findByOwnerId(OWNER_ID)).isEmpty();
    }

    @Test
    @DisplayName("소유자의 체크리스트를 반드시 가져올 때는 도메인을 그대로 반환한다")
    void shouldGetChecklistByOwnerId() {
        // given
        Checklist saved = saveChecklist(OWNER_ID);

        // when
        Checklist found = checklistRepository.getByOwnerId(OWNER_ID);

        // then
        assertThat(found)
                .extracting(Checklist::id, Checklist::ownerId)
                .containsExactly(saved.id(), OWNER_ID);
    }

    @Test
    @DisplayName("소유자의 체크리스트가 없으면 조회 단계에서 오류를 던진다")
    void shouldThrowWhenOwnerHasNoChecklist() {
        // when, then
        assertThatThrownBy(() -> checklistRepository.getByOwnerId(OWNER_ID))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CHECKLIST_NOT_FOUND);
    }

    @Test
    @DisplayName("체크리스트에 할 일을 저장하고 생성된 식별자를 채워 반환한다")
    void shouldSaveChecklistItemAndReturnGeneratedId() {
        // given
        Checklist checklist = saveChecklist(OWNER_ID);

        // when
        ChecklistItem saved = saveItem(checklist, 100L);

        // then
        assertThat(saved.id()).isNotNull();
        assertThat(saved)
                .extracting(
                        ChecklistItem::categoryId,
                        ChecklistItem::title,
                        ChecklistItem::sourceCatalogItemId,
                        ChecklistItem::isDone
                )
                .containsExactly(CATEGORY_ID, "계약서 확인", 100L, false);
    }

    @Test
    @DisplayName("여러 할 일을 한 번에 저장하고 생성된 식별자를 채워 반환한다")
    void shouldSaveAllItemsAndReturnGeneratedIds() {
        // given
        Checklist checklist = saveChecklist(OWNER_ID);
        List<ChecklistItem> items = List.of(
                new ChecklistItem(null, CATEGORY_ID, "계약서 확인", 100L, ChecklistItemStatus.PREV),
                new ChecklistItem(null, CATEGORY_ID, "견적 비교", 101L, ChecklistItemStatus.PREV)
        );

        // when
        List<ChecklistItem> saved = checklistRepository.saveItems(checklist, items);

        // then
        assertThat(saved).hasSize(2).allSatisfy(item -> assertThat(item.id()).isNotNull());
        assertThat(checklistRepository.getByOwnerId(OWNER_ID).items())
                .extracting(ChecklistItem::sourceCatalogItemId)
                .containsExactly(100L, 101L);
    }

    @Test
    @DisplayName("같은 체크리스트에 같은 준비 항목을 두 번 저장하면 중복 준비 항목 오류를 던진다")
    void shouldRejectSaveWhenSameCatalogItemSavedTwice() {
        // given
        Checklist checklist = saveChecklist(OWNER_ID);
        saveItem(checklist, 100L);

        // when, then
        assertThatThrownBy(() -> saveItem(checklist, 100L))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.DUPLICATE_CHECKLIST_ITEM);
    }

    @Test
    @DisplayName("이미 추가된 준비 항목이 포함된 채로 한 번에 저장하면 중복 준비 항목 오류를 던진다")
    void shouldRejectSaveAllWhenCatalogItemAlreadyAdded() {
        // given
        Checklist checklist = saveChecklist(OWNER_ID);
        saveItem(checklist, 100L);
        List<ChecklistItem> items = List.of(
                new ChecklistItem(null, CATEGORY_ID, "계약서 확인", 100L, ChecklistItemStatus.PREV)
        );

        // when, then
        assertThatThrownBy(() -> checklistRepository.saveItems(checklist, items))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.DUPLICATE_CHECKLIST_ITEM);
    }

    @Test
    @DisplayName("직접 만든 할 일은 원본 준비 항목이 없어 여러 번 저장할 수 있다")
    void shouldAllowMultipleItemsWithoutSourceCatalogItem() {
        // given
        Checklist checklist = saveChecklist(OWNER_ID);
        saveItem(checklist, null);

        // when
        saveItem(checklist, null);

        // then
        assertThat(checklistRepository.getByOwnerId(OWNER_ID).items()).hasSize(2);
    }

    @Test
    @DisplayName("식별자가 일치하는 할 일만 삭제한다")
    void shouldDeleteOnlyChecklistItemWithGivenId() {
        // given
        Checklist checklist = saveChecklist(OWNER_ID);
        ChecklistItem target = saveItem(checklist, 100L);
        ChecklistItem other = saveItem(checklist, 101L);

        // when
        checklistRepository.deleteItem(target);

        // then
        assertThat(jpaChecklistItemRepository.findById(target.id())).isEmpty();
        assertThat(jpaChecklistItemRepository.findById(other.id())).isPresent();
    }

    @Test
    @DisplayName("체크리스트를 삭제하면 그 체크리스트의 할 일까지 함께 삭제한다")
    void shouldDeleteChecklistWithItsItems() {
        // given
        Checklist target = saveChecklist(OWNER_ID);
        ChecklistItem targetItem = saveItem(target, 100L);
        Checklist other = saveChecklist(OTHER_OWNER_ID);
        ChecklistItem otherItem = saveItem(other, 102L);

        // when
        checklistRepository.delete(target);

        // then
        assertThat(jpaChecklistRepository.findById(target.id())).isEmpty();
        assertThat(jpaChecklistItemRepository.findById(targetItem.id())).isEmpty();
        assertThat(jpaChecklistRepository.findById(other.id())).isPresent();
        assertThat(jpaChecklistItemRepository.findById(otherItem.id())).isPresent();
    }

    private Checklist saveChecklist(Long ownerId) {
        return checklistRepository.save(new Checklist(null, ownerId, List.of()));
    }

    private ChecklistItem saveItem(Checklist checklist, Long sourceCatalogItemId) {
        return checklistRepository.saveItem(checklist, new ChecklistItem(
                null,
                CATEGORY_ID,
                "계약서 확인",
                sourceCatalogItemId,
                ChecklistItemStatus.PREV
        ));
    }
}
