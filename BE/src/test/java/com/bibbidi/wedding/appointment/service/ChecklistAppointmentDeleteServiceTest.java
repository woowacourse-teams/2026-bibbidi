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
class ChecklistAppointmentDeleteServiceTest {

    @Mock
    private AppointmentRepository appointmentRepository;

    private ChecklistAppointmentDeleteService checklistAppointmentDeleteService;

    @BeforeEach
    void setUp() {
        checklistAppointmentDeleteService = new ChecklistAppointmentDeleteService(appointmentRepository);
    }

    @Test
    @DisplayName("지정한 할 일들에 속한 일정을 모두 삭제한다")
    void shouldDeleteAppointmentsByChecklistItemIds() {
        checklistAppointmentDeleteService.deleteAllByChecklistItemIds(List.of(10L, 11L));

        then(appointmentRepository).should().deleteAllByChecklistItemIds(List.of(10L, 11L));
    }

    @Test
    @DisplayName("삭제할 할 일이 없으면 저장소를 호출하지 않는다")
    void shouldSkipDeletionWhenChecklistItemIdsAreEmpty() {
        checklistAppointmentDeleteService.deleteAllByChecklistItemIds(List.of());

        then(appointmentRepository).shouldHaveNoInteractions();
    }
}
