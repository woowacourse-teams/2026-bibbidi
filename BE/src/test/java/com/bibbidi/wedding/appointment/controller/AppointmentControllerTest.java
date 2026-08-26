package com.bibbidi.wedding.appointment.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.appointment.controller.dto.CreateAppointmentRequest;
import com.bibbidi.wedding.appointment.service.AppointmentService;
import com.bibbidi.wedding.auth.config.AuthWebConfig;
import com.bibbidi.wedding.auth.session.AuthArgumentResolver;
import com.bibbidi.wedding.auth.session.AuthSession;
import com.bibbidi.wedding.auth.session.SessionUserIdProvider;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
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

    @Autowired
    private AuthArgumentResolver argumentResolver;

    @MockitoBean
    private AppointmentService appointmentService;

    @Test
    @DisplayName("제목이 비어 있으면 일정 생성 요청을 거부한다")
    void shouldRejectRequestWhenTitleIsBlank() throws Exception {
        // given
        CreateAppointmentRequest request = new CreateAppointmentRequest(
                " ", LocalDate.of(2026, 9, 1), null, null, null, null
        );

        // when, then
        mockMvc.perform(post("/api/checklist-items/1/appointments")
                .session(authenticatedSession())
                .contentType(MediaType.APPLICATION_JSON)
                .content(convertToStringValue(request))
        ).andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("시작 시간이 종료 시간보다 늦으면 일정 생성 요청을 거부한다")
    void shouldRejectRequestWhenStartTimeIsAfterEndTime() throws Exception {
        // given
        CreateAppointmentRequest request = new CreateAppointmentRequest(
                "상담", LocalDate.of(2026, 9, 1),
                LocalDateTime.of(2026, 9, 1, 11, 0),
                LocalDateTime.of(2026, 9, 1, 10, 0), null, null
        );

        // when, then
        mockMvc.perform(post("/api/checklist-items/1/appointments")
                .session(authenticatedSession())
                .contentType(MediaType.APPLICATION_JSON)
                .content(convertToStringValue(request))
        ).andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("인증되지 않은 사용자의 일정 생성 요청을 거부한다")
    void shouldRejectRequestWhenUnauthenticated() throws Exception {
        // given
        CreateAppointmentRequest request = new CreateAppointmentRequest(
                "상담", LocalDate.of(2026, 9, 1), null, null, null, null
        );

        // when, then
        mockMvc.perform(post("/api/checklist-items/1/appointments")
                .contentType(MediaType.APPLICATION_JSON)
                .content(convertToStringValue(request))
        ).andExpect(status().isUnauthorized());
    }

    private String convertToStringValue(CreateAppointmentRequest request) {
        return objectMapper.writeValueAsString(request);
    }

    private static MockHttpSession authenticatedSession() {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(AuthSession.USER_ID_ATTRIBUTE, 1L);
        return session;
    }
}
