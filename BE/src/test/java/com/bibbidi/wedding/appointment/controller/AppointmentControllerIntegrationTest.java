package com.bibbidi.wedding.appointment.controller;

import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.parameterWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.documentationConfiguration;
import static org.springframework.restdocs.payload.PayloadDocumentation.fieldWithPath;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

import com.bibbidi.wedding.appointment.controller.dto.CreateAppointmentRequest;
import com.bibbidi.wedding.appointment.controller.dto.UpdateAppointmentRequest;
import com.bibbidi.wedding.appointment.domain.Appointment;
import com.bibbidi.wedding.appointment.repository.AppointmentRepository;
import com.bibbidi.wedding.auth.session.AuthSession;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.restdocs.RestDocumentationContextProvider;
import org.springframework.restdocs.RestDocumentationExtension;
import org.springframework.restdocs.payload.FieldDescriptor;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@ExtendWith(RestDocumentationExtension.class)
class AppointmentControllerIntegrationTest {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AppointmentRepository appointmentRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp(RestDocumentationContextProvider restDocumentation) {
        mockMvc = webAppContextSetup(context)
                .apply(documentationConfiguration(restDocumentation))
                .build();
    }

    @Test
    @DisplayName("인증된 사용자가 일정 생성에 성공한다")
    void shouldCreateAppointmentWhenRequestIsValid() throws Exception {
        // given
        CreateAppointmentRequest request = new CreateAppointmentRequest(
                "웨딩홀 상담",
                LocalDate.of(2026, 9, 1),
                LocalDateTime.of(2026, 9, 1, 10, 0),
                LocalDateTime.of(2026, 9, 1, 11, 0),
                "웨딩홀",
                "상담 준비"
        );

        // when & then
        mockMvc.perform(post("/api/checklist-items/{itemId}/appointments", 1L)
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(convertToStringValue(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.checklistItemId").value(1))
                .andExpect(jsonPath("$.title").value("웨딩홀 상담"))
                .andExpect(jsonPath("$.date").value("2026-09-01"))
                .andExpect(jsonPath("$.isDone").value(false))
                .andDo(document(
                        "appointments-create",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Appointment")
                                .summary("일정 생성")
                                .description("체크리스트 항목에 수행 일정을 추가합니다.")
                                .requestSchema(schema("CreateAppointmentRequest"))
                                .responseSchema(schema("AppointmentResponse"))
                                .pathParameters(parameterWithName("itemId").description("체크리스트 항목 ID"))
                                .requestFields(requestFields())
                                .responseFields(appointmentResponseFields())
                                .build())
                ));
    }

    @Test
    @DisplayName("잘못된 입력이면 일정 생성을 거부한다")
    void shouldRejectAppointmentWhenRequestIsInvalid() throws Exception {
        // given
        CreateAppointmentRequest request = new CreateAppointmentRequest(
                "",
                LocalDate.of(2026, 9, 1),
                LocalDateTime.of(2026, 9, 1, 11, 0),
                LocalDateTime.of(2026, 9, 1, 10, 0),
                "웨딩홀",
                "상담 준비"
        );

        // when & then
        mockMvc.perform(post("/api/checklist-items/{itemId}/appointments", 1L)
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(convertToStringValue(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(101))
                .andExpect(jsonPath("$.errors").isArray())
                .andDo(document(
                        "appointments-create-invalid-request",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Appointment")
                                .summary("잘못된 일정 생성 요청")
                                .description("입력값이 유효하지 않으면 요청을 거부합니다.")
                                .requestSchema(schema("CreateAppointmentRequest"))
                                .responseSchema(schema("ValidationErrorResponse"))
                                .pathParameters(parameterWithName("itemId").description("체크리스트 항목 ID"))
                                .requestFields(requestFields())
                                .responseFields(validationResponseFields())
                                .build())
                ));
    }

    @Test
    @DisplayName("인증되지 않은 사용자의 일정 생성을 거부한다")
    void shouldRejectAppointmentWhenUserIsUnauthenticated() throws Exception {
        // given
        CreateAppointmentRequest request = new CreateAppointmentRequest(
                "웨딩홀 상담", LocalDate.of(2026, 9, 1), null, null, null, null
        );

        // when & then
        mockMvc.perform(post("/api/checklist-items/{itemId}/appointments", 1L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(convertToStringValue(request)))
                .andExpect(status().isUnauthorized())
                .andDo(document(
                        "appointments-create-unauthorized",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Appointment")
                                .summary("인증 없이 일정 생성")
                                .description("인증되지 않은 요청은 거부합니다.")
                                .requestSchema(schema("CreateAppointmentRequest"))
                                .responseSchema(schema("ErrorResponse"))
                                .pathParameters(parameterWithName("itemId").description("체크리스트 항목 ID"))
                                .requestFields(
                                        fieldWithPath("title").description("일정 제목"),
                                        fieldWithPath("date").description("일정 날짜")
                                )
                                .responseFields(errorResponseFields())
                                .build())
                ));
    }

    @Test
    @DisplayName("인증된 사용자가 일정 수정에 성공한다")
    void shouldUpdateAppointmentWhenRequestIsValid() throws Exception {
        // given
        Long appointmentId = saveAppointment().id();
        UpdateAppointmentRequest request = new UpdateAppointmentRequest(
                "웨딩홀 재상담",
                LocalDate.of(2026, 10, 1),
                LocalDateTime.of(2026, 10, 1, 14, 0),
                LocalDateTime.of(2026, 10, 1, 15, 0),
                "제2 웨딩홀",
                "견적서 지참"
        );

        // when & then
        mockMvc.perform(put("/api/appointments/{appointmentId}", appointmentId)
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(convertToStringValue(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("웨딩홀 재상담"))
                .andExpect(jsonPath("$.isDone").value(true))
                .andDo(document(
                        "appointments-update",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Appointment")
                                .summary("일정 수정")
                                .description("등록된 일정의 내용을 수정합니다. 완료 여부는 변경되지 않습니다.")
                                .requestSchema(schema("UpdateAppointmentRequest"))
                                .responseSchema(schema("AppointmentResponse"))
                                .pathParameters(parameterWithName("appointmentId").description("일정 ID"))
                                .requestFields(requestFields())
                                .responseFields(appointmentResponseFields())
                                .build())
                ));
    }

    @Test
    @DisplayName("잘못된 입력이면 일정 수정을 거부한다")
    void shouldRejectUpdateWhenRequestIsInvalid() throws Exception {
        // given
        Long appointmentId = saveAppointment().id();
        UpdateAppointmentRequest request = new UpdateAppointmentRequest(
                "",
                LocalDate.of(2026, 10, 1),
                LocalDateTime.of(2026, 10, 1, 15, 0),
                LocalDateTime.of(2026, 10, 1, 14, 0),
                "제2 웨딩홀",
                "견적서 지참"
        );

        // when & then
        mockMvc.perform(put("/api/appointments/{appointmentId}", appointmentId)
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(convertToStringValue(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(101))
                .andExpect(jsonPath("$.errors").isArray())
                .andDo(document(
                        "appointments-update-invalid-request",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Appointment")
                                .summary("잘못된 일정 수정 요청")
                                .description("입력값이 유효하지 않으면 요청을 거부합니다.")
                                .requestSchema(schema("UpdateAppointmentRequest"))
                                .responseSchema(schema("ValidationErrorResponse"))
                                .pathParameters(parameterWithName("appointmentId").description("일정 ID"))
                                .requestFields(requestFields())
                                .responseFields(validationResponseFields())
                                .build())
                ));
    }

    @Test
    @DisplayName("존재하지 않는 일정의 수정을 거부한다")
    void shouldRejectUpdateWhenAppointmentDoesNotExist() throws Exception {
        // given
        UpdateAppointmentRequest request = new UpdateAppointmentRequest(
                "웨딩홀 재상담", LocalDate.of(2026, 10, 1), null, null, null, null
        );

        // when & then
        mockMvc.perform(put("/api/appointments/{appointmentId}", 99999L)
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(convertToStringValue(request)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value(302))
                .andDo(document(
                        "appointments-update-not-found",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Appointment")
                                .summary("존재하지 않는 일정 수정")
                                .description("수정 대상 일정이 없으면 요청을 거부합니다.")
                                .requestSchema(schema("UpdateAppointmentRequest"))
                                .responseSchema(schema("ErrorResponse"))
                                .pathParameters(parameterWithName("appointmentId").description("일정 ID"))
                                .requestFields(
                                        fieldWithPath("title").description("일정 제목"),
                                        fieldWithPath("date").description("일정 날짜")
                                )
                                .responseFields(errorResponseFields())
                                .build())
                ));
    }

    @Test
    @DisplayName("인증되지 않은 사용자의 일정 수정을 거부한다")
    void shouldRejectUpdateWhenUserIsUnauthenticated() throws Exception {
        // given
        Long appointmentId = saveAppointment().id();
        UpdateAppointmentRequest request = new UpdateAppointmentRequest(
                "웨딩홀 재상담", LocalDate.of(2026, 10, 1), null, null, null, null
        );

        // when & then
        mockMvc.perform(put("/api/appointments/{appointmentId}", appointmentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(convertToStringValue(request)))
                .andExpect(status().isUnauthorized())
                .andDo(document(
                        "appointments-update-unauthorized",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Appointment")
                                .summary("인증 없이 일정 수정")
                                .description("인증되지 않은 요청은 거부합니다.")
                                .requestSchema(schema("UpdateAppointmentRequest"))
                                .responseSchema(schema("ErrorResponse"))
                                .pathParameters(parameterWithName("appointmentId").description("일정 ID"))
                                .requestFields(
                                        fieldWithPath("title").description("일정 제목"),
                                        fieldWithPath("date").description("일정 날짜")
                                )
                                .responseFields(errorResponseFields())
                                .build())
                ));
    }

    private Appointment saveAppointment() {
        return appointmentRepository.save(new Appointment(
                null,
                1L,
                "웨딩홀 상담",
                LocalDate.of(2026, 9, 1),
                LocalDateTime.of(2026, 9, 1, 10, 0),
                LocalDateTime.of(2026, 9, 1, 11, 0),
                "웨딩홀",
                "상담 준비",
                true
        ));
    }

    private String convertToStringValue(Object request) {
        ObjectNode json = objectMapper.valueToTree(request);
        removeIfNull(json, "startTime");
        removeIfNull(json, "endTime");
        removeIfNull(json, "place");
        removeIfNull(json, "memo");
        return objectMapper.writeValueAsString(json);
    }

    private void removeIfNull(ObjectNode json, String fieldName) {
        if (json.get(fieldName).isNull()) {
            json.remove(fieldName);
        }
    }

    private static MockHttpSession authenticatedSession() {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(AuthSession.USER_ID_ATTRIBUTE, 1L);
        return session;
    }

    private static FieldDescriptor[] requestFields() {
        return new FieldDescriptor[]{
                fieldWithPath("title").description("일정 제목"),
                fieldWithPath("date").description("일정 날짜"),
                fieldWithPath("startTime").description("시작 일시").optional(),
                fieldWithPath("endTime").description("종료 일시").optional(),
                fieldWithPath("place").description("장소").optional(),
                fieldWithPath("memo").description("메모").optional()
        };
    }

    private static FieldDescriptor[] appointmentResponseFields() {
        return new FieldDescriptor[]{
                fieldWithPath("id").description("일정 ID"),
                fieldWithPath("checklistItemId").description("체크리스트 항목 ID"),
                fieldWithPath("title").description("일정 제목"),
                fieldWithPath("date").description("일정 날짜"),
                fieldWithPath("place").description("장소"),
                fieldWithPath("memo").description("메모"),
                fieldWithPath("isDone").description("완료 여부"),
                fieldWithPath("startTime").description("시작 일시"),
                fieldWithPath("endTime").description("종료 일시")
        };
    }

    private static FieldDescriptor[] errorResponseFields() {
        return new FieldDescriptor[]{
                fieldWithPath("errorCode").description("오류 코드"),
                fieldWithPath("message").description("오류 메시지")
        };
    }

    private static FieldDescriptor[] validationResponseFields() {
        return new FieldDescriptor[]{
                fieldWithPath("errorCode").description("오류 코드"),
                fieldWithPath("message").description("오류 메시지"),
                fieldWithPath("errors").description("필드별 검증 오류 목록"),
                fieldWithPath("errors[].field").description("검증에 실패한 필드"),
                fieldWithPath("errors[].message").description("검증 오류 메시지")
        };
    }
}
