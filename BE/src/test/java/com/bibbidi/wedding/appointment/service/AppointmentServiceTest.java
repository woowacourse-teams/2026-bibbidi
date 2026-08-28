package com.bibbidi.wedding.appointment.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;

import com.bibbidi.wedding.appointment.domain.Appointment;
import com.bibbidi.wedding.appointment.repository.AppointmentRepository;
import com.bibbidi.wedding.appointment.service.dto.AppointmentCreationCommand;
import com.bibbidi.wedding.appointment.service.dto.AppointmentUpdateCommand;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.time.LocalDate;
import java.time.LocalDateTime;
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
        given(checklistService.checkItemOwnership(USER_ID, CHECKLIST_ITEM_ID)).willReturn(false);

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
        given(checklistService.checkItemOwnership(USER_ID, CHECKLIST_ITEM_ID)).willReturn(false);

        assertThatThrownBy(() -> appointmentService.update(updateCommand()))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CHECKLIST_ITEM_ACCESS_DENIED);

        then(appointmentRepository).should(never()).save(any(Appointment.class));
    }

    private static Appointment appointment() {
        return new Appointment(APPOINTMENT_ID, CHECKLIST_ITEM_ID, "title",
                LocalDate.of(2026, 9, 1), LocalDateTime.of(2026, 9, 1, 10, 0),
                LocalDateTime.of(2026, 9, 1, 11, 0), "place", "memo", false);
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
