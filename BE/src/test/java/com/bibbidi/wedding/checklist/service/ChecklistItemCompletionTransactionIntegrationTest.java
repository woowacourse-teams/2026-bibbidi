package com.bibbidi.wedding.checklist.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.willThrow;

import com.bibbidi.wedding.appointment.persistence.JpaAppointmentEntity;
import com.bibbidi.wedding.appointment.persistence.JpaAppointmentRepository;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemRepository;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistRepository;
import java.time.LocalDate;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

@SpringBootTest
@ActiveProfiles("test")
class ChecklistItemCompletionTransactionIntegrationTest {

    private static final Long OWNER_ID = 1L;

    @Autowired
    private ChecklistService checklistService;

    @Autowired
    private JpaChecklistRepository jpaChecklistRepository;

    @MockitoSpyBean
    private JpaChecklistItemRepository jpaChecklistItemRepository;

    @Autowired
    private JpaAppointmentRepository jpaAppointmentRepository;

    @AfterEach
    void cleanUp() {
        jpaAppointmentRepository.deleteAllInBatch();
        jpaChecklistItemRepository.deleteAllInBatch();
        jpaChecklistRepository.deleteAllInBatch();
    }

    @Test
    @DisplayName("할 일 완료 중 실패하면 먼저 완료한 일정도 롤백한다")
    void shouldRollbackCompletedAppointmentsWhenChecklistItemCompletionFails() {
        // given
        JpaChecklistEntity checklist = jpaChecklistRepository.saveAndFlush(
                new JpaChecklistEntity(null, OWNER_ID)
        );
        JpaChecklistItemEntity checklistItem = jpaChecklistItemRepository.saveAndFlush(
                new JpaChecklistItemEntity(
                        null,
                        checklist,
                        1L,
                        null,
                        "청첩장 문구 정하기",
                        ChecklistItemStatus.PREV
                )
        );
        JpaAppointmentEntity appointment = jpaAppointmentRepository.saveAndFlush(
                new JpaAppointmentEntity(
                        null,
                        checklistItem.id(),
                        "청첩장 문구 검토",
                        LocalDate.of(2026, 9, 1),
                        null,
                        null,
                        null,
                        null,
                        false,
                        false
                )
        );
        willThrow(new IllegalStateException("checklist item completion failed"))
                .given(jpaChecklistItemRepository)
                .saveAndFlush(any(JpaChecklistItemEntity.class));

        // when, then
        assertThatThrownBy(() -> checklistService.changeItemStatus(OWNER_ID, checklistItem.id(), "DONE"))
                .isInstanceOf(DataAccessException.class)
                .hasRootCauseInstanceOf(IllegalStateException.class)
                .hasRootCauseMessage("checklist item completion failed");
        assertThat(jpaChecklistItemRepository.findById(checklistItem.id()).orElseThrow().status())
                .isEqualTo(ChecklistItemStatus.PREV);
        assertThat(jpaAppointmentRepository.findById(appointment.id()).orElseThrow())
                .satisfies(rolledBack -> {
                    assertThat(rolledBack.isDone()).isFalse();
                    assertThat(rolledBack.doneByChecklistItem()).isFalse();
                });
    }
}
