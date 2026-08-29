package com.bibbidi.wedding.appointment.service;

import static org.mockito.BDDMockito.then;

import com.bibbidi.wedding.appointment.repository.AppointmentRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AppointmentDeletionServiceTest {

    @Mock
    private AppointmentRepository appointmentRepository;

    private AppointmentDeletionService appointmentDeletionService;

    @BeforeEach
    void setUp() {
        appointmentDeletionService = new AppointmentDeletionService(appointmentRepository);
    }

    @Test
    @DisplayName("지정한 일정들을 새 할 일로 이동한다")
    void shouldChangeChecklistItemIdsInBulk() {
        appointmentDeletionService.changeAllToNewChecklistItemIds(20L, List.of(1L, 2L));

        then(appointmentRepository).should().changeAllToNewChecklistItemIds(20L, List.of(1L, 2L));
    }

    @Test
    @DisplayName("지정한 일정들을 모두 삭제한다")
    void shouldDeleteAppointmentsInBulk() {
        appointmentDeletionService.deleteAll(List.of(1L, 2L));

        then(appointmentRepository).should().deleteAll(List.of(1L, 2L));
    }

    @Test
    @DisplayName("지정한 할 일들에 속한 일정을 모두 삭제한다")
    void shouldDeleteAppointmentsByChecklistItemIds() {
        appointmentDeletionService.deleteAllByChecklistItemIds(List.of(10L, 11L));

        then(appointmentRepository).should().deleteAllByChecklistItemIds(List.of(10L, 11L));
    }

    @Test
    @DisplayName("삭제하거나 이동할 일정이 없으면 저장소를 호출하지 않는다")
    void shouldSkipBulkOperationsWhenTargetIdsAreEmpty() {
        appointmentDeletionService.changeAllToNewChecklistItemIds(20L, List.of());
        appointmentDeletionService.deleteAll(List.of());
        appointmentDeletionService.deleteAllByChecklistItemIds(List.of());

        then(appointmentRepository).shouldHaveNoInteractions();
    }
}
