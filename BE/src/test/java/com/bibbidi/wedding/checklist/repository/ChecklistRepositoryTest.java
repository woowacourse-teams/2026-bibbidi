package com.bibbidi.wedding.checklist.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistRepository;
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

    @Test
    @DisplayName("빈 체크리스트를 저장하고 생성된 식별자를 채워 반환한다")
    void shouldSaveChecklistAndReturnGeneratedId() {
        // given
        Checklist checklist = new Checklist(null, OWNER_ID);

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
    @DisplayName("소유자별로 체크리스트 존재 여부를 판단한다")
    void shouldDecideWhetherOwnerHasChecklist() {
        // given
        checklistRepository.save(new Checklist(null, OWNER_ID));

        // when, then
        assertThat(checklistRepository.existsByOwnerId(OWNER_ID)).isTrue();
        assertThat(checklistRepository.existsByOwnerId(2L)).isFalse();
    }

    @Test
    @DisplayName("소유자의 체크리스트를 조회하면 도메인으로 변환해 반환한다")
    void shouldFindChecklistByOwnerId() {
        // given
        Checklist saved = checklistRepository.save(new Checklist(null, OWNER_ID));

        // when
        Optional<Checklist> found = checklistRepository.findByOwnerId(OWNER_ID);

        // then
        assertThat(found)
                .get()
                .extracting(Checklist::id, Checklist::ownerId)
                .containsExactly(saved.id(), OWNER_ID);
    }

    @Test
    @DisplayName("소유자의 체크리스트가 없으면 빈 결과를 반환한다")
    void shouldReturnEmptyWhenOwnerHasNoChecklist() {
        // when, then
        assertThat(checklistRepository.findByOwnerId(OWNER_ID)).isEmpty();
    }

    @Test
    @DisplayName("식별자가 일치하는 체크리스트만 삭제한다")
    void shouldDeleteOnlyChecklistWithGivenId() {
        Checklist target = checklistRepository.save(new Checklist(null, OWNER_ID));
        Checklist other = checklistRepository.save(new Checklist(null, 2L));

        int deletedCount = checklistRepository.deleteById(target.id());

        assertThat(deletedCount).isOne();
        assertThat(jpaChecklistRepository.findById(target.id())).isEmpty();
        assertThat(jpaChecklistRepository.findById(other.id())).isPresent();
    }
}
