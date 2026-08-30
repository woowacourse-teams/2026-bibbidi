package com.bibbidi.wedding.appointment.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;

import com.bibbidi.wedding.appointment.domain.Appointment;
import com.bibbidi.wedding.appointment.repository.AppointmentRepository;
import com.bibbidi.wedding.appointment.service.dto.AppointmentCreationCommand;
import com.bibbidi.wedding.appointment.service.dto.AppointmentConflict;
import com.bibbidi.wedding.appointment.service.dto.AppointmentUpdateCommand;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AppointmentServiceTest {

    private static final Long USER_ID = 1L;
    private static final Long CHECKLIST_ITEM_ID = 10L;
    private static final Long APPOINTMENT_ID = 100L;

    @Mock
    private AppointmentRepository appointmentRepository;

    @Mock
    private ChecklistService checklistService;

    private AppointmentService appointmentService;

    @BeforeEach
    void setUp() {
        appointmentService = new AppointmentService(appointmentRepository, checklistService);
    }

    @Test
    @DisplayName("소유하지 않은 체크리스트 항목에는 일정을 생성할 수 없다")
    void shouldDenyCreateWhenUserDoesNotOwnChecklistItem() {
        given(checklistService.checkItemOwnership(CHECKLIST_ITEM_ID, USER_ID)).willReturn(false);

        assertThatThrownBy(() -> appointmentService.create(createCommand()))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CHECKLIST_ITEM_ACCESS_DENIED);

        then(appointmentRepository).should(never()).save(any(Appointment.class));
    }

    @Test
    @DisplayName("소유하지 않은 체크리스트 항목의 일정은 수정할 수 없다")
    void shouldDenyUpdateWhenUserDoesNotOwnAppointmentChecklistItem() {
        given(appointmentRepository.findById(APPOINTMENT_ID)).willReturn(appointment());
        given(checklistService.checkItemOwnership(CHECKLIST_ITEM_ID, USER_ID)).willReturn(false);

        assertThatThrownBy(() -> appointmentService.update(updateCommand()))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CHECKLIST_ITEM_ACCESS_DENIED);

        then(appointmentRepository).should(never()).save(any(Appointment.class));
    }

    @Test
    @DisplayName("자신이 소유한 일정은 삭제할 수 있다")
    void shouldDeleteAppointmentWhenUserOwnsChecklistItem() {
        given(appointmentRepository.findById(APPOINTMENT_ID)).willReturn(appointment());
        given(checklistService.checkItemOwnership(CHECKLIST_ITEM_ID, USER_ID)).willReturn(true);

        appointmentService.delete(USER_ID, APPOINTMENT_ID);

        then(appointmentRepository).should().deleteById(APPOINTMENT_ID);
    }

    @Test
    @DisplayName("존재하지 않는 일정은 삭제할 수 없다")
    void shouldFailWhenAppointmentDoesNotExist() {
        BusinessException exception = new BusinessException(ClientError.APPOINTMENT_NOT_FOUND, "not found");
        given(appointmentRepository.findById(APPOINTMENT_ID)).willThrow(exception);

        assertThatThrownBy(() -> appointmentService.delete(USER_ID, APPOINTMENT_ID))
                .isSameAs(exception);

        then(appointmentRepository).should(never()).deleteById(any());
    }

    @Test
    void shouldChangeChecklistItemIdsInBulk() {
        appointmentService.changeAllToNewChecklistItemIds(20L, List.of(1L, 2L));

        then(appointmentRepository).should().changeAllToNewChecklistItemIds(20L, List.of(1L, 2L));
    }

    @Test
    void shouldDeleteAppointmentsInBulk() {
        appointmentService.deleteAll(List.of(1L, 2L));

        then(appointmentRepository).should().deleteAll(List.of(1L, 2L));
    }

    @Test
    @DisplayName("할 일에 연결된 일정을 모두 삭제한다")
    void shouldDeleteAllAppointmentsByChecklistItemId() {
        appointmentService.deleteAllByChecklistItemId(CHECKLIST_ITEM_ID);

        then(appointmentRepository).should().deleteAllByChecklistItemId(CHECKLIST_ITEM_ID);
    }

    @Test
    void shouldSkipBulkOperationsWhenTargetIdsAreEmpty() {
        appointmentService.changeAllToNewChecklistItemIds(20L, List.of());
        appointmentService.deleteAll(List.of());

        then(appointmentRepository).shouldHaveNoInteractions();
    }

    @Test
    void shouldReturnConflictsAfterCreatingAppointment() {
        Appointment saved = new Appointment(
                200L,
                CHECKLIST_ITEM_ID,
                "new appointment",
                LocalDate.of(2026, 9, 1),
                LocalDateTime.of(2026, 9, 1, 10, 0),
                LocalDateTime.of(2026, 9, 1, 11, 0),
                "place",
                "memo",
                false
        );
        AppointmentConflict conflict = new AppointmentConflict(
                300L, 20L, "conflict", saved.date(),
                LocalDateTime.of(2026, 9, 1, 10, 30),
                LocalDateTime.of(2026, 9, 1, 11, 30), "other place");
        given(checklistService.checkItemOwnership(CHECKLIST_ITEM_ID, USER_ID)).willReturn(true);
        given(appointmentRepository.save(any(Appointment.class))).willReturn(saved);
        given(appointmentRepository.findOverlapCandidates(USER_ID, saved))
                .willReturn(List.of(new Appointment(
                        conflict.appointmentId(),
                        conflict.checklistItemId(),
                        conflict.title(),
                        conflict.date(),
                        conflict.startTime(),
                        conflict.endTime(),
                        conflict.place(),
                        null,
                        false
                )));

        assertThat(appointmentService.create(createCommand()).conflicts()).containsExactly(conflict);
    }

    private static Appointment appointment() {
        return new Appointment(
                APPOINTMENT_ID,
                CHECKLIST_ITEM_ID,
                "title",
                LocalDate.of(2026, 9, 1),
                LocalDateTime.of(2026, 9, 1, 10, 0),
                LocalDateTime.of(2026, 9, 1, 11, 0),
                "place",
                "memo",
                false
        );
    }

    private static AppointmentCreationCommand createCommand() {
        return new AppointmentCreationCommand(USER_ID, CHECKLIST_ITEM_ID, "title",
                LocalDate.of(2026, 9, 1), LocalDateTime.of(2026, 9, 1, 10, 0),
                LocalDateTime.of(2026, 9, 1, 11, 0), "place", "memo");
    }

    private static AppointmentUpdateCommand updateCommand() {
        return new AppointmentUpdateCommand(APPOINTMENT_ID, USER_ID, "updated title",
                LocalDate.of(2026, 10, 1), LocalDateTime.of(2026, 10, 1, 10, 0),
                LocalDateTime.of(2026, 10, 1, 11, 0), "updated place", "updated memo");
    }
}
