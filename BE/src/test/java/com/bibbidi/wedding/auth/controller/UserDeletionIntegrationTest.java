package com.bibbidi.wedding.auth.controller;

import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.headerWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.springframework.restdocs.operation.preprocess.Preprocessors.modifyHeaders;
import static org.springframework.restdocs.operation.preprocess.Preprocessors.preprocessResponse;
import static org.springframework.restdocs.payload.PayloadDocumentation.fieldWithPath;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.appointment.controller.dto.CreateAppointmentRequest;
import com.bibbidi.wedding.auth.controller.dto.LoginRequest;
import com.bibbidi.wedding.checklist.controller.dto.ChecklistItemResponse;
import com.bibbidi.wedding.checklist.controller.dto.CreateChecklistItemRequest;
import com.bibbidi.wedding.support.BibbidiIntegrationTest;
import com.bibbidi.wedding.user.controller.dto.DeleteUserRequest;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.ObjectMapper;

@Sql("/user-deletion-fixture.sql")
class UserDeletionIntegrationTest extends BibbidiIntegrationTest {

    private static final String PASSWORD = "wish";
    private static final Long CATEGORY_ID = 1000L;
    private static final Long OTHER_CHECKLIST_ID = 1001L;
    private static final String DOCUMENTED_SESSION_COOKIE =
            "JSESSIONID=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax";

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("현재 사용자를 탈퇴시키고 세션을 만료한다")
    void shouldDeleteCurrentUserAndInvalidateSession() throws Exception {
        MockHttpSession currentSession = login("current");
        Long checklistItemId = createChecklistItem(currentSession);
        createAppointment(currentSession, checklistItemId);

        mockMvc.perform(delete("/api/users/me")
                        .session(currentSession)
                        .header(HttpHeaders.COOKIE, "JSESSIONID=" + currentSession.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new DeleteUserRequest(PASSWORD))))
                .andExpect(status().isNoContent())
                .andDo(document(
                                "users-delete-me",
                                preprocessResponse(modifyHeaders().set(
                                                HttpHeaders.SET_COOKIE,
                                                DOCUMENTED_SESSION_COOKIE
                                        )
                                ),
                                resource(ResourceSnippetParameters.builder()
                                        .tag("User")
                                        .summary("회원 탈퇴")
                                        .description(
                                                "인증된 사용자를 탈퇴 처리하고 사용자의 결혼식 데이터를 삭제한 뒤 세션 쿠키를 만료합니다.")
                                        .requestSchema(schema("DeleteUserRequest"))
                                        .requestHeaders(
                                                headerWithName(HttpHeaders.COOKIE)
                                                        .description("인증된 JSESSIONID 세션 쿠키")
                                        )
                                        .requestFields(
                                                fieldWithPath("password")
                                                        .description("회원 탈퇴를 확인하기 위한 현재 비밀번호")
                                        )
                                        .responseHeaders(
                                                headerWithName(HttpHeaders.SET_COOKIE)
                                                        .description("만료된 JSESSIONID 세션 쿠키")
                                        )
                                        .build()
                                )
                        )
                );

        mockMvc.perform(get("/api/catalog"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.categories[0].id").value(CATEGORY_ID));

        mockMvc.perform(get("/api/checklists/me").session(currentSession))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201));

        MockHttpSession otherSession = login("other");
        mockMvc.perform(get("/api/checklists/me").session(otherSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(OTHER_CHECKLIST_ID))
                .andExpect(jsonPath("$.items[0].appointments[0].id").isNumber());
    }

    private MockHttpSession login(String nickname) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(nickname, PASSWORD))))
                .andExpect(status().isOk())
                .andReturn();

        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private Long createChecklistItem(MockHttpSession session) throws Exception {
        String response = mockMvc.perform(post("/api/checklists/me/items")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateChecklistItemRequest("custom item", CATEGORY_ID))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        return objectMapper.readValue(response, ChecklistItemResponse.class).id();
    }

    private void createAppointment(MockHttpSession session, Long checklistItemId) throws Exception {
        CreateAppointmentRequest request = new CreateAppointmentRequest(
                "appointment", LocalDate.of(2026, 9, 1), null, null, null, null
        );

        mockMvc.perform(post("/api/checklist-items/{checklistItemId}/appointments", checklistItemId)
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated());
    }
}
