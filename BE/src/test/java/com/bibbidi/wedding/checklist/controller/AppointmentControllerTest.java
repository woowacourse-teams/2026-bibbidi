package com.bibbidi.wedding.checklist.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.BDDMockito.then;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.checklist.controller.dto.req.CreateAppointmentRequest;
import com.bibbidi.wedding.checklist.controller.dto.req.UpdateAppointmentRequest;
import com.bibbidi.wedding.checklist.service.AppointmentService;
import com.bibbidi.wedding.checklist.service.dto.AppointmentCreationCommand;
import com.bibbidi.wedding.checklist.service.dto.AppointmentResult;
import com.bibbidi.wedding.checklist.service.dto.AppointmentUpdateCommand;
import com.bibbidi.wedding.auth.config.AuthWebConfig;
import com.bibbidi.wedding.auth.session.AuthArgumentResolver;
import com.bibbidi.wedding.auth.session.AuthSession;
import com.bibbidi.wedding.auth.session.SessionUserIdProvider;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
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
        AppointmentResult serviceResult = new AppointmentResult(
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
                " ",
                LocalDate.of(2026, 9, 1),
                null,
                null,
                null,
                null
        );

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
        AppointmentResult result = new AppointmentResult(
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
                "appointment",
                LocalDate.of(2026, 9, 1),
                null,
                null,
                null,
                null
        );

        mockMvc.perform(put("/api/appointments/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("일정 삭제 요청을 서비스 명령으로 전달한다")
    void shouldDeleteAppointment() throws Exception {
        mockMvc.perform(delete("/api/appointments/1")
                        .session(authenticatedSession()))
                .andExpect(status().isNoContent());

        then(appointmentService).should().delete(1L, 1L);
    }

    @Test
    @DisplayName("가까운 일정 조회 시 limit을 생략하면 기본값 6으로 서비스에 전달한다")
    void shouldUseDefaultLimitWhenNotProvided() throws Exception {
        when(appointmentService.findNearby(1L, 6)).thenReturn(List.of(
                new AppointmentResult(
                        1L, 10L, "title", LocalDate.of(2026, 9, 1),
                        LocalDateTime.of(2026, 9, 1, 10, 0),
                        LocalDateTime.of(2026, 9, 1, 11, 0),
                        "place", "memo", false)
        ));

        mockMvc.perform(get("/api/appointments/me/nearby")
                        .session(authenticatedSession()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1));

        verify(appointmentService).findNearby(1L, 6);
    }

    @Test
    @DisplayName("가까운 일정 조회 시 limit 파라미터를 서비스에 그대로 전달한다")
    void shouldPassGivenLimitToService() throws Exception {
        when(appointmentService.findNearby(1L, 3)).thenReturn(List.of());

        mockMvc.perform(get("/api/appointments/me/nearby")
                        .session(authenticatedSession())
                        .param("limit", "3"))
                .andExpect(status().isOk());

        verify(appointmentService).findNearby(1L, 3);
    }

    @Test
    @DisplayName("limit이 최대값을 넘으면 가까운 일정 조회를 거부한다")
    void shouldRejectNearbyRequestWhenLimitExceedsMax() throws Exception {
        mockMvc.perform(get("/api/appointments/me/nearby")
                        .session(authenticatedSession())
                        .param("limit", "21"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("limit이 1보다 작으면 가까운 일정 조회를 거부한다")
    void shouldRejectNearbyRequestWhenLimitIsBelowMinimum() throws Exception {
        mockMvc.perform(get("/api/appointments/me/nearby")
                        .session(authenticatedSession())
                        .param("limit", "0"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("미인증 가까운 일정 조회 요청을 거부한다")
    void shouldRejectNearbyRequestWhenUnauthenticated() throws Exception {
        mockMvc.perform(get("/api/appointments/me/nearby"))
                .andExpect(status().isUnauthorized());
    }

    private static MockHttpSession authenticatedSession() {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(AuthSession.USER_ID_ATTRIBUTE, 1L);
        return session;
    }
}
