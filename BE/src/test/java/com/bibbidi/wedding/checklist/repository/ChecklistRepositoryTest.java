package com.bibbidi.wedding.checklist.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.domain.ChecklistItem;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemEntity;
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
        Checklist saved = checklistRepository.save(new Checklist(null, OWNER_ID, List.of()));

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
        Checklist saved = checklistRepository.save(new Checklist(null, OWNER_ID, List.of()));
        JpaChecklistEntity checklistEntity = jpaChecklistRepository.getReferenceById(saved.id());
        JpaChecklistItemEntity itemEntity = jpaChecklistItemRepository.saveAndFlush(
                new JpaChecklistItemEntity(
                        null,
                        checklistEntity,
                        2L,
                        null,
                        "계약서 확인",
                        ChecklistItemStatus.PREV
                )
        );

        // when
        Checklist found = checklistRepository.getByOwnerId(OWNER_ID);

        // then
        assertThat(found.items())
                .singleElement()
                .extracting(ChecklistItem::id, ChecklistItem::title)
                .containsExactly(itemEntity.id(), "계약서 확인");
    }

    @Test
    @DisplayName("할 일 식별자로 체크리스트를 조회하면 같은 체크리스트의 할 일 목록까지 조립한다")
    void shouldFindAssembledChecklistByChecklistItemId() {
        // given
        Checklist saved = checklistRepository.save(new Checklist(null, OWNER_ID, List.of()));
        JpaChecklistEntity checklistEntity = jpaChecklistRepository.getReferenceById(saved.id());
        JpaChecklistItemEntity target = jpaChecklistItemRepository.saveAndFlush(
                new JpaChecklistItemEntity(
                        null,
                        checklistEntity,
                        2L,
                        null,
                        "계약서 확인",
                        ChecklistItemStatus.PREV
                )
        );

        // when
        Checklist found = checklistRepository.getByChecklistItemId(target.id());

        // then
        assertThat(found.id()).isEqualTo(saved.id());
        assertThat(found.items())
                .singleElement()
                .extracting(ChecklistItem::id)
                .isEqualTo(target.id());
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
        Checklist saved = checklistRepository.save(new Checklist(null, OWNER_ID, List.of()));

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
    @DisplayName("식별자가 일치하는 체크리스트만 삭제한다")
    void shouldDeleteOnlyChecklistWithGivenId() {
        Checklist target = checklistRepository.save(new Checklist(null, OWNER_ID, List.of()));
        Checklist other = checklistRepository.save(new Checklist(null, 2L, List.of()));

        int deletedCount = checklistRepository.deleteById(target.id());

        assertThat(deletedCount).isOne();
        assertThat(jpaChecklistRepository.findById(target.id())).isEmpty();
        assertThat(jpaChecklistRepository.findById(other.id())).isPresent();
    }
}
