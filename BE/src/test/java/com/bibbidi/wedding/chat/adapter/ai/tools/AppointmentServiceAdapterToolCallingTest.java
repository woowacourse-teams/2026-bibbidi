package com.bibbidi.wedding.chat.adapter.ai.tools;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.chat.support.ToolCallingFixture;
import com.bibbidi.wedding.checklist.service.AppointmentService;
import com.bibbidi.wedding.checklist.service.dto.AppointmentCompletionCommand;
import com.bibbidi.wedding.checklist.service.dto.AppointmentCompletionResult;
import com.bibbidi.wedding.checklist.service.dto.AppointmentCreationCommand;
import com.bibbidi.wedding.checklist.service.dto.AppointmentResult;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AppointmentServiceAdapterToolCallingTest {

    private static final Long USER_ID = 7L;
    private static final Long OTHER_USER_ID = 8L;

    private AppointmentService appointmentService;
    private ToolCallingFixture toolCalling;

    @BeforeEach
    void setUp() {
        appointmentService = mock(AppointmentService.class);
        toolCalling = new ToolCallingFixture(new AppointmentServiceAdapter(appointmentService));
    }

    @Test
    @DisplayName("일정 도구를 모델 요청에 등록한다")
    void registersTheAppointmentToolsOnTheModelRequest() {
        assertThat(toolCalling.registeredToolNames(USER_ID)).containsExactlyInAnyOrder(
                "createAppointment", "updateAppointment", "changeAppointmentDone", "deleteAppointment");
    }

    @Test
    @DisplayName("일정 추가 도구는 날짜·시각 인자를 바인딩해 요청에 담긴 사용자로 AppointmentService를 호출한다")
    void createsTheAppointmentForTheUserOfTheRequest() {
        // given
        AppointmentCreationCommand command = new AppointmentCreationCommand(USER_ID, 10L, "계약",
                LocalDate.of(2026, 11, 5), LocalDateTime.of(2026, 11, 5, 14, 0),
                LocalDateTime.of(2026, 11, 5, 15, 0), "강남", null);
        when(appointmentService.create(command)).thenReturn(new AppointmentResult(
                40L, 10L, "계약", LocalDate.of(2026, 11, 5), null, null, "강남", null, false));

        // when
        String response = toolCalling.callTool(USER_ID, "createAppointment",
                "{\"checklistItemId\": 10, \"title\": \"계약\", \"date\": \"2026-11-05\","
                        + " \"startTime\": \"2026-11-05T14:00\", \"endTime\": \"2026-11-05T15:00\","
                        + " \"place\": \"강남\", \"userId\": " + OTHER_USER_ID + "}");

        // then
        verify(appointmentService).create(command);
        assertThat(response).contains("\"id\":40");
    }

    @Test
    @DisplayName("일정 완료 도구는 요청에 담긴 사용자로 완료 상태를 바꾼다")
    void changesTheAppointmentCompletionForTheUserOfTheRequest() {
        // given
        AppointmentCompletionCommand command = new AppointmentCompletionCommand(31L, USER_ID, true);
        when(appointmentService.changeStatus(command))
                .thenReturn(new AppointmentCompletionResult(31L, true, 10L, false));

        // when
        String response = toolCalling.callTool(USER_ID, "changeAppointmentDone",
                "{\"appointmentId\": 31, \"isDone\": true}");

        // then
        verify(appointmentService).changeStatus(command);
        assertThat(response).contains("\"id\":31");
    }

    @Test
    @DisplayName("일정 삭제 도구는 요청에 담긴 사용자로 일정을 삭제한다")
    void deletesTheAppointmentForTheUserOfTheRequest() {
        toolCalling.callTool(USER_ID, "deleteAppointment", "{\"appointmentId\": 31}");

        verify(appointmentService).delete(USER_ID, 31L);
    }
}
