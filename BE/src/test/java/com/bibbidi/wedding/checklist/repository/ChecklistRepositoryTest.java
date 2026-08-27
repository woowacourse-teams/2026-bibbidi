package com.bibbidi.wedding.checklist.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@ActiveProfiles("test")
@Import(ChecklistRepository.class)
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
}
