package com.bibbidi.wedding.appointment.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.never;

import com.bibbidi.wedding.appointment.domain.Appointment;
import com.bibbidi.wedding.appointment.repository.AppointmentRepository;
import com.bibbidi.wedding.appointment.service.dto.AppointmentCompletionCommand;
import com.bibbidi.wedding.appointment.service.dto.AppointmentCompletionResult;
import com.bibbidi.wedding.appointment.service.dto.AppointmentConflict;
import com.bibbidi.wedding.appointment.service.dto.AppointmentCreationCommand;
import com.bibbidi.wedding.appointment.service.dto.AppointmentCreationResult;
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
        willThrow(new BusinessException(ClientError.CHECKLIST_ITEM_ACCESS_DENIED, "access denied"))
                .given(checklistService)
                .validateItemOwnership(CHECKLIST_ITEM_ID, USER_ID);

        assertThatThrownBy(() -> appointmentService.create(createCommand()))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CHECKLIST_ITEM_ACCESS_DENIED);

        then(appointmentRepository).should(never()).save(any(Appointment.class));
    }

    @Test
    @DisplayName("소유하지 않은 체크리스트 항목의 일정은 수정할 수 없다")
    void shouldDenyUpdateWhenUserDoesNotOwnAppointmentChecklistItem() {
        given(appointmentRepository.findById(APPOINTMENT_ID)).willReturn(createAppointment());
        willThrow(new BusinessException(ClientError.CHECKLIST_ITEM_ACCESS_DENIED, "access denied"))
                .given(checklistService)
                .validateItemOwnership(CHECKLIST_ITEM_ID, USER_ID);

        assertThatThrownBy(() -> appointmentService.update(updateCommand()))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CHECKLIST_ITEM_ACCESS_DENIED);

        then(appointmentRepository).should(never()).save(any(Appointment.class));
    }

    @Test
    @DisplayName("자신이 소유한 일정은 삭제할 수 있다")
    void shouldDeleteAppointmentWhenUserOwnsChecklistItem() {
        given(appointmentRepository.findById(APPOINTMENT_ID)).willReturn(createAppointment());

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
    @DisplayName("지정한 일정들을 새 할 일로 이동한다")
    void shouldChangeChecklistItemIdsInBulk() {
        appointmentService.changeAllToNewChecklistItemIds(20L, List.of(1L, 2L));

        then(appointmentRepository).should().changeAllToNewChecklistItemIds(20L, List.of(1L, 2L));
    }

    @Test
    @DisplayName("지정한 일정들을 모두 삭제한다")
    void shouldDeleteAppointmentsInBulk() {
        appointmentService.deleteAll(List.of(1L, 2L));

        then(appointmentRepository).should().deleteAll(List.of(1L, 2L));
    }

    @Test
    @DisplayName("삭제하거나 이동할 일정이 없으면 저장소를 호출하지 않는다")
    void shouldSkipBulkOperationsWhenTargetIdsAreEmpty() {
        appointmentService.changeAllToNewChecklistItemIds(20L, List.of());
        appointmentService.deleteAll(List.of());

        then(appointmentRepository).shouldHaveNoInteractions();
    }

    @Test
    @DisplayName("새 일정을 생성하고 일정 시간이 겹치는 충돌 목록을 반환한다")
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
                false,
                false
        );
        AppointmentConflict conflict = new AppointmentConflict(
                300L, 20L, "conflict", saved.date(),
                LocalDateTime.of(2026, 9, 1, 10, 30),
                LocalDateTime.of(2026, 9, 1, 11, 30), "other place");
        Appointment conflictingAppointment = new Appointment(
                conflict.appointmentId(),
                conflict.checklistItemId(),
                conflict.title(),
                conflict.date(),
                conflict.startTime(),
                conflict.endTime(),
                conflict.place(),
                null,
                false,
                false
        );
        given(appointmentRepository.save(any(Appointment.class))).willReturn(saved);
        given(appointmentRepository.findOverlapCandidates(USER_ID, saved))
                .willReturn(List.of(conflictingAppointment));

        AppointmentCreationResult result = appointmentService.create(createCommand());

        assertThat(result.conflicts()).containsExactly(conflict);
    }

    @Test
    @DisplayName("일정 완료 상태를 변경하고 체크리스트 결과를 함께 반환한다")
    void shouldChangeAppointmentCompletionAndReturnChecklistItemStatus() {
        Appointment appointment = createAppointment();
        AppointmentCompletionCommand command = new AppointmentCompletionCommand(
                APPOINTMENT_ID,
                USER_ID,
                true
        );
        given(appointmentRepository.findById(APPOINTMENT_ID)).willReturn(appointment);
        given(appointmentRepository.save(any(Appointment.class)))
                .willAnswer(invocation -> invocation.getArgument(0));
        given(checklistService.changeItemStatusByAppointment(USER_ID, CHECKLIST_ITEM_ID, true))
                .willReturn(false);

        AppointmentCompletionResult result = appointmentService.changeStatus(command);

        assertThat(result)
                .extracting(
                        AppointmentCompletionResult::id,
                        AppointmentCompletionResult::isDone,
                        AppointmentCompletionResult::checklistItemId,
                        AppointmentCompletionResult::checklistItemDone
                )
                .containsExactly(APPOINTMENT_ID, true, CHECKLIST_ITEM_ID, false);
        then(checklistService).should().changeItemStatusByAppointment(USER_ID, CHECKLIST_ITEM_ID, true);
    }

    private static Appointment createAppointment() {
        return new Appointment(
                APPOINTMENT_ID,
                CHECKLIST_ITEM_ID,
                "title",
                LocalDate.of(2026, 9, 1),
                LocalDateTime.of(2026, 9, 1, 10, 0),
                LocalDateTime.of(2026, 9, 1, 11, 0),
                "place",
                "memo",
                false,
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
