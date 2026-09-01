package com.bibbidi.wedding.appointment.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

import com.bibbidi.wedding.appointment.domain.Appointment;
import com.bibbidi.wedding.appointment.repository.AppointmentRepository;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ChecklistAppointmentServiceTest {

    private static final Long CHECKLIST_ITEM_ID = 10L;

    @Mock
    private AppointmentRepository appointmentRepository;

    @Captor
    private ArgumentCaptor<List<Appointment>> savedAppointmentsCaptor;

    private ChecklistAppointmentService checklistAppointmentService;

    @BeforeEach
    void setUp() {
        checklistAppointmentService = new ChecklistAppointmentService(appointmentRepository);
    }

    @Test
    @DisplayName("할 일에 남은 일정을 모두 완료하고 할 일 때문에 완료했다고 표시한다")
    void shouldCompleteRemainingAppointmentsWithChecklistItem() {
        given(appointmentRepository.findAllRemainingByChecklistItemId(CHECKLIST_ITEM_ID))
                .willReturn(List.of(appointment(1L), appointment(2L)));

        checklistAppointmentService.completeAllByChecklistItemId(CHECKLIST_ITEM_ID);

        then(appointmentRepository).should().saveAll(savedAppointmentsCaptor.capture());
        assertThat(savedAppointmentsCaptor.getValue())
                .allSatisfy(saved -> {
                    assertThat(saved.isDone()).isTrue();
                    assertThat(saved.doneByChecklistItem()).isTrue();
                });
    }

    @Test
    @DisplayName("남은 일정이 없으면 완료할 일정도 없다")
    void shouldCompleteNothingWhenNoAppointmentRemains() {
        given(appointmentRepository.findAllRemainingByChecklistItemId(CHECKLIST_ITEM_ID))
                .willReturn(List.of());

        checklistAppointmentService.completeAllByChecklistItemId(CHECKLIST_ITEM_ID);

        then(appointmentRepository).should().saveAll(List.of());
    }

    private static Appointment appointment(Long id) {
        return new Appointment(
                id,
                CHECKLIST_ITEM_ID,
                "일정",
                LocalDate.of(2026, 9, 1),
                null,
                null,
                null,
                null,
                false,
                false
        );
    }

    @Test
    @DisplayName("지정한 할 일 하나에 속한 일정을 모두 삭제한다")
    void shouldDeleteAppointmentsByChecklistItemId() {
        checklistAppointmentService.deleteAllByChecklistItemId(10L);

        then(appointmentRepository).should().deleteAllByChecklistItemIds(List.of(10L));
    }

    @Test
    @DisplayName("지정한 할 일들에 속한 일정을 모두 삭제한다")
    void shouldDeleteAppointmentsByChecklistItemIds() {
        checklistAppointmentService.deleteAllByChecklistItemIds(List.of(10L, 11L));

        then(appointmentRepository).should().deleteAllByChecklistItemIds(List.of(10L, 11L));
    }

    @Test
    @DisplayName("삭제할 할 일이 없으면 저장소를 호출하지 않는다")
    void shouldSkipDeletionWhenChecklistItemIdsAreEmpty() {
        checklistAppointmentService.deleteAllByChecklistItemIds(List.of());

        then(appointmentRepository).shouldHaveNoInteractions();
    }
}
