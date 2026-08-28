package com.bibbidi.wedding.appointment.controller;

import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.parameterWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.documentationConfiguration;
import static org.springframework.restdocs.payload.PayloadDocumentation.fieldWithPath;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

import com.bibbidi.wedding.appointment.controller.dto.CreateAppointmentRequest;
import com.bibbidi.wedding.appointment.controller.dto.UpdateAppointmentRequest;
import com.bibbidi.wedding.appointment.domain.Appointment;
import com.bibbidi.wedding.appointment.persistence.JpaAppointmentRepository;
import com.bibbidi.wedding.appointment.repository.AppointmentRepository;
import com.bibbidi.wedding.auth.session.AuthSession;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import java.util.Arrays;
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
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Sql("/appointment-fixture.sql")
@ExtendWith(RestDocumentationExtension.class)
class AppointmentControllerIntegrationTest {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private JpaAppointmentRepository jpaAppointmentRepository;

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
        mockMvc.perform(post("/api/checklist-items/{checklistItemId}/appointments", 1L)
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
                                .pathParameters(parameterWithName("checklistItemId").description("체크리스트 항목 ID"))
                                .requestFields(requestFields())
                                .responseFields(appointmentResponseFields())
                                .build())
                ));
    }

    @Test
    @DisplayName("기존 일정과 시간이 겹치는 일정을 생성하면 생성에 성공하고 충돌 목록을 함께 반환한다")
    void shouldReturnConflictsWhenCreatingOverlappingAppointment() throws Exception {
        Long existingAppointmentId = saveAppointment().id();
        CreateAppointmentRequest request = new CreateAppointmentRequest(
                "overlapping appointment",
                LocalDate.of(2026, 9, 1),
                LocalDateTime.of(2026, 9, 1, 10, 30),
                LocalDateTime.of(2026, 9, 1, 11, 30),
                "different place",
                "상담 준비"
        );

        mockMvc.perform(post("/api/checklist-items/{checklistItemId}/appointments", 1L)
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(convertToStringValue(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.conflicts[0].appointmentId").value(existingAppointmentId))
                .andExpect(jsonPath("$.conflicts[0].checklistItemId").value(1))
                .andExpect(jsonPath("$.conflicts[0].startTime").value("2026-09-01T10:00:00"))
                .andDo(document(
                        "appointments-create-conflict",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Appointment")
                                .summary("충돌 일정이 있는 일정 생성")
                                .description("시간이 겹치는 일정을 경고로 반환하고 일정 생성은 허용합니다.")
                                .requestSchema(schema("CreateAppointmentRequest"))
                                .responseSchema(schema("AppointmentResponse"))
                                .pathParameters(parameterWithName("checklistItemId").description("체크리스트 항목 ID"))
                                .requestFields(requestFields())
                                .responseFields(conflictAppointmentResponseFields())
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
        mockMvc.perform(post("/api/checklist-items/{checklistItemId}/appointments", 1L)
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
                                .pathParameters(parameterWithName("checklistItemId").description("체크리스트 항목 ID"))
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
                "웨딩홀 상담",
                LocalDate.of(2026, 9, 1),
                null,
                null,
                null,
                null
        );

        // when & then
        mockMvc.perform(post("/api/checklist-items/{checklistItemId}/appointments", 1L)
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
                                .pathParameters(parameterWithName("checklistItemId").description("체크리스트 항목 ID"))
                                .requestFields(
                                        fieldWithPath("title").description("일정 제목"),
                                        fieldWithPath("date").description("일정 날짜")
                                )
                                .responseFields(errorResponseFields())
                                .build())
                ));
    }

    @Test
    @DisplayName("인증된 사용자가 소유하지 않은 체크리스트 항목으로 일정 생성을 요청하면 거부한다")
    void shouldRejectAppointmentWhenUserDoesNotOwnChecklistItem() throws Exception {
        CreateAppointmentRequest request = new CreateAppointmentRequest(
                "웨딩홀 상담",
                LocalDate.of(2026, 9, 1),
                null,
                null,
                null,
                null
        );

        mockMvc.perform(post("/api/checklist-items/{checklistItemId}/appointments", 999L)
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(convertToStringValue(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value(203));
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
    @DisplayName("수정한 시간이 다른 일정과 겹치면 수정에 성공하고 충돌 목록을 함께 반환한다")
    void shouldReturnConflictsWhenUpdatingAppointment() throws Exception {
        saveAppointment();
        Long appointmentId = saveAppointment().id();
        UpdateAppointmentRequest request = new UpdateAppointmentRequest(
                "updated overlapping appointment",
                LocalDate.of(2026, 9, 1),
                LocalDateTime.of(2026, 9, 1, 10, 30),
                LocalDateTime.of(2026, 9, 1, 11, 30),
                "different place",
                "상담 준비"
        );

        mockMvc.perform(put("/api/appointments/{appointmentId}", appointmentId)
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(convertToStringValue(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.conflicts[0].appointmentId").isNumber())
                .andExpect(jsonPath("$.conflicts[0].appointmentId").value(appointmentId - 1))
                .andDo(document(
                        "appointments-update-conflict",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Appointment")
                                .summary("충돌 일정이 있는 일정 수정")
                                .description("시간이 겹치는 일정을 경고로 반환하고 일정 수정은 허용합니다.")
                                .requestSchema(schema("UpdateAppointmentRequest"))
                                .responseSchema(schema("AppointmentResponse"))
                                .pathParameters(parameterWithName("appointmentId").description("일정 ID"))
                                .requestFields(requestFields())
                                .responseFields(conflictAppointmentResponseFields())
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
                "웨딩홀 재상담",
                LocalDate.of(2026, 10, 1),
                null,
                null,
                null,
                null
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
                "웨딩홀 재상담",
                LocalDate.of(2026, 10, 1),
                null,
                null,
                null,
                null
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

    @Test
    @DisplayName("다른 사용자의 체크리스트 항목에 속한 일정 수정은 거부한다")
    void shouldRejectUpdateWhenUserDoesNotOwnChecklistItem() throws Exception {
        Long appointmentId = saveAppointment().id();
        UpdateAppointmentRequest request = new UpdateAppointmentRequest(
                "updated title",
                LocalDate.of(2026, 10, 1),
                null,
                null,
                null,
                null
        );

        mockMvc.perform(put("/api/appointments/{appointmentId}", appointmentId)
                        .session(sessionOf(2L))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(convertToStringValue(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value(203));
    }

    @Test
    @DisplayName("자신의 일정은 삭제할 수 있다")
    void shouldDeleteOwnAppointment() throws Exception {
        Long appointmentId = saveAppointment().id();

        mockMvc.perform(delete("/api/appointments/{appointmentId}", appointmentId)
                        .session(authenticatedSession()))
                .andExpect(status().isNoContent())
                .andDo(document(
                        "appointments-delete",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Appointment")
                                .summary("일정 삭제")
                                .description("현재 사용자가 소유한 일정을 삭제합니다.")
                                .pathParameters(parameterWithName("appointmentId").description("일정 ID"))
                                .build())
                ));

        assertThat(jpaAppointmentRepository.findById(appointmentId)).isEmpty();
    }

    @Test
    @DisplayName("다른 사용자의 일정은 삭제할 수 없다")
    void shouldRejectDeletingAnotherUsersAppointment() throws Exception {
        Long appointmentId = saveAppointment().id();

        mockMvc.perform(delete("/api/appointments/{appointmentId}", appointmentId)
                        .session(sessionOf(2L)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value(203))
                .andDo(document(
                        "appointments-delete-forbidden",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Appointment")
                                .summary("일정 삭제 권한 없음")
                                .description("다른 사용자의 일정 삭제 요청을 거부합니다.")
                                .responseSchema(schema("ErrorResponse"))
                                .pathParameters(parameterWithName("appointmentId").description("일정 ID"))
                                .responseFields(errorResponseFields())
                                .build())
                ));

        assertThat(jpaAppointmentRepository.findById(appointmentId)).isPresent();
    }

    @Test
    @DisplayName("존재하지 않는 일정 삭제 요청은 404를 반환한다")
    void shouldRejectDeletingNonexistentAppointment() throws Exception {
        mockMvc.perform(delete("/api/appointments/{appointmentId}", 99999L)
                        .session(authenticatedSession()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value(302))
                .andDo(document(
                        "appointments-delete-not-found",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Appointment")
                                .summary("존재하지 않는 일정 삭제")
                                .description("존재하지 않는 일정 삭제 요청을 거부합니다.")
                                .responseSchema(schema("ErrorResponse"))
                                .pathParameters(parameterWithName("appointmentId").description("일정 ID"))
                                .responseFields(errorResponseFields())
                                .build())
                ));
    }

    @Test
    @DisplayName("인증되지 않은 사용자의 일정 삭제 요청은 거부한다")
    void shouldRejectDeletingAppointmentWhenUserIsUnauthenticated() throws Exception {
        Long appointmentId = saveAppointment().id();

        mockMvc.perform(delete("/api/appointments/{appointmentId}", appointmentId))
                .andExpect(status().isUnauthorized())
                .andDo(document(
                        "appointments-delete-unauthorized",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Appointment")
                                .summary("인증 없이 일정 삭제")
                                .description("인증되지 않은 일정 삭제 요청을 거부합니다.")
                                .responseSchema(schema("ErrorResponse"))
                                .pathParameters(parameterWithName("appointmentId").description("일정 ID"))
                                .responseFields(errorResponseFields())
                                .build())
                ));
    }

    @Test
    @DisplayName("일정을 삭제해도 같은 할 일의 다른 일정은 유지된다")
    void shouldKeepOtherAppointmentWhenDeletingAnAppointment() throws Exception {
        Long deletedAppointmentId = saveAppointment().id();
        Long remainingAppointmentId = saveAppointment().id();

        mockMvc.perform(delete("/api/appointments/{appointmentId}", deletedAppointmentId)
                        .session(authenticatedSession()))
                .andExpect(status().isNoContent());

        assertThat(jpaAppointmentRepository.findById(deletedAppointmentId)).isEmpty();
        assertThat(jpaAppointmentRepository.findById(remainingAppointmentId)).isPresent();
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
        return sessionOf(1L);
    }

    private static MockHttpSession sessionOf(Long userId) {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(AuthSession.USER_ID_ATTRIBUTE, userId);
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
                fieldWithPath("conflicts").description("conflicts"),
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

    private static FieldDescriptor[] conflictAppointmentResponseFields() {
        FieldDescriptor[] appointmentFields = appointmentResponseFields();
        FieldDescriptor[] conflictFields = new FieldDescriptor[]{
                fieldWithPath("conflicts[].appointmentId").description("충돌 일정 ID"),
                fieldWithPath("conflicts[].checklistItemId").description("충돌 체크리스트 항목 ID"),
                fieldWithPath("conflicts[].title").description("충돌 일정 제목"),
                fieldWithPath("conflicts[].date").description("충돌 일정 날짜"),
                fieldWithPath("conflicts[].startTime").description("충돌 일정 시작 시각"),
                fieldWithPath("conflicts[].endTime").description("충돌 일정 종료 시각"),
                fieldWithPath("conflicts[].place").description("충돌 일정 장소")
        };
        FieldDescriptor[] fields = Arrays.copyOf(
                appointmentFields,
                appointmentFields.length + conflictFields.length
        );
        System.arraycopy(conflictFields, 0, fields, appointmentFields.length, conflictFields.length);
        return fields;
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
