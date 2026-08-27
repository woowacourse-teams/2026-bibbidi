package com.bibbidi.wedding.appointment.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.appointment.controller.dto.CreateAppointmentRequest;
import com.bibbidi.wedding.appointment.controller.dto.UpdateAppointmentRequest;
import com.bibbidi.wedding.appointment.service.AppointmentService;
import com.bibbidi.wedding.appointment.service.dto.AppointmentCreationCommand;
import com.bibbidi.wedding.appointment.service.dto.AppointmentCreationResult;
import com.bibbidi.wedding.appointment.service.dto.AppointmentUpdateCommand;
import com.bibbidi.wedding.appointment.service.dto.AppointmentUpdateResult;
import com.bibbidi.wedding.auth.config.AuthWebConfig;
import com.bibbidi.wedding.auth.session.AuthArgumentResolver;
import com.bibbidi.wedding.auth.session.AuthSession;
import com.bibbidi.wedding.auth.session.SessionUserIdProvider;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@WebMvcTest(AppointmentController.class)
@Import({AuthWebConfig.class, AuthArgumentResolver.class, SessionUserIdProvider.class})
class AppointmentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private AppointmentService appointmentService;

    @Test
    @DisplayName("생성 요청을 서비스 명령으로 변환한다")
    void shouldConvertCreateRequestToAppointmentCreationCommand() throws Exception {
        CreateAppointmentRequest request = new CreateAppointmentRequest(
                "consultation", LocalDate.of(2026, 9, 1),
                LocalDateTime.of(2026, 9, 1, 10, 0),
                LocalDateTime.of(2026, 9, 1, 11, 0), "place", "memo"
        );
        AppointmentCreationResult serviceResult = new AppointmentCreationResult(
                1L,
                1L, request.title(),
                request.date(),
                request.startTime(),
                request.endTime(),
                request.place(),
                request.memo(),
                false
        );
        when(appointmentService.create(any(AppointmentCreationCommand.class)))
                .thenReturn(serviceResult);

        mockMvc.perform(post("/api/checklist-items/1/appointments")
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated());

        ArgumentCaptor<AppointmentCreationCommand> captor = ArgumentCaptor.forClass(AppointmentCreationCommand.class);
        verify(appointmentService).create(captor.capture());
        assertThat(captor.getValue()).isEqualTo(new AppointmentCreationCommand(
                1L,
                request.title(),
                request.date(),
                request.startTime(),
                request.endTime(),
                request.place(), request.memo()));
    }

    @Test
    @DisplayName("제목이 비어 있으면 생성 요청을 거부한다")
    void shouldRejectCreateRequestWhenTitleIsBlank() throws Exception {
        CreateAppointmentRequest request = new CreateAppointmentRequest(
                " ", LocalDate.of(2026, 9, 1), null, null, null, null);

        mockMvc.perform(post("/api/checklist-items/1/appointments")
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("시작 시간이 종료 시간보다 늦으면 생성 요청을 거부한다")
    void shouldRejectCreateRequestWhenTimeRangeIsInvalid() throws Exception {
        CreateAppointmentRequest request = new CreateAppointmentRequest(
                "appointment", LocalDate.of(2026, 9, 1),
                LocalDateTime.of(2026, 9, 1, 11, 0),
                LocalDateTime.of(2026, 9, 1, 10, 0), null, null);

        mockMvc.perform(post("/api/checklist-items/1/appointments")
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("수정 요청을 서비스 명령으로 변환한다")
    void shouldConvertUpdateRequestToAppointmentUpdateCommand() throws Exception {
        UpdateAppointmentRequest request = new UpdateAppointmentRequest(
                "updated title", LocalDate.of(2026, 10, 1),
                LocalDateTime.of(2026, 10, 1, 14, 0),
                LocalDateTime.of(2026, 10, 1, 15, 0), "updated place", "updated memo"
        );
        AppointmentUpdateResult result = new AppointmentUpdateResult(
                1L, 1L, request.title(), request.date(), request.startTime(), request.endTime(),
                request.place(), request.memo(), true);
        when(appointmentService.update(any(AppointmentUpdateCommand.class))).thenReturn(result);

        mockMvc.perform(put("/api/appointments/1")
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        ArgumentCaptor<AppointmentUpdateCommand> captor = ArgumentCaptor.forClass(AppointmentUpdateCommand.class);
        verify(appointmentService).update(captor.capture());
        assertThat(captor.getValue()).isEqualTo(new AppointmentUpdateCommand(
                1L, 1L, request.title(), request.date(), request.startTime(), request.endTime(),
                request.place(), request.memo()));
    }

    @Test
    @DisplayName("잘못된 시간 범위의 수정 요청을 거부한다")
    void shouldRejectUpdateRequestWhenTimeRangeIsInvalid() throws Exception {
        UpdateAppointmentRequest request = new UpdateAppointmentRequest(
                "appointment", LocalDate.of(2026, 9, 1),
                LocalDateTime.of(2026, 9, 1, 11, 0),
                LocalDateTime.of(2026, 9, 1, 10, 0), null, null);

        mockMvc.perform(put("/api/appointments/1")
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("미인증 수정 요청을 거부한다")
    void shouldRejectUpdateRequestWhenUnauthenticated() throws Exception {
        UpdateAppointmentRequest request = new UpdateAppointmentRequest(
                "appointment", LocalDate.of(2026, 9, 1), null, null, null, null);

        mockMvc.perform(put("/api/appointments/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    private static MockHttpSession authenticatedSession() {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(AuthSession.USER_ID_ATTRIBUTE, 1L);
        return session;
    }
}
