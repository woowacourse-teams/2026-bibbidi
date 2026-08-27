package com.bibbidi.wedding.auth.controller;

import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.headerWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.documentationConfiguration;
import static org.springframework.restdocs.payload.PayloadDocumentation.fieldWithPath;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

import com.bibbidi.wedding.auth.controller.dto.CreateUserRequest;
import com.bibbidi.wedding.auth.controller.dto.LoginRequest;
import com.bibbidi.wedding.auth.session.AuthSession;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.restdocs.RestDocumentationContextProvider;
import org.springframework.restdocs.RestDocumentationExtension;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@ExtendWith({OutputCaptureExtension.class, RestDocumentationExtension.class})
class PasswordChangeControllerIntegrationTest {

    private static final String PASSWORD = "wish";
    private static final String NEW_PASSWORD = "magic";
    private static final String DOCUMENTED_SESSION_COOKIE = "JSESSIONID=<session-id>";
    private static final String CHANGE_PASSWORD_DESCRIPTION =
            "현재 인증 Session의 사용자가 현재 비밀번호를 확인한 뒤 새 비밀번호로 변경합니다. "
                    + "비밀번호 변경 후에도 현재 Session은 유지됩니다.";

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private ObjectMapper objectMapper;

    private MockMvc mockMvc;
    private Long currentUserId;
    private Long otherUserId;

    @BeforeEach
    void setUp(RestDocumentationContextProvider restDocumentation) throws Exception {
        mockMvc = webAppContextSetup(context)
                .apply(documentationConfiguration(restDocumentation))
                .build();
        currentUserId = createUser("current");
        otherUserId = createUser("other");
    }

    @Test
    @DisplayName("현재 사용자의 비밀번호를 변경하고 현재 Session을 유지한다")
    void shouldChangeCurrentUserPasswordAndKeepSession() throws Exception {
        MockHttpSession session = authenticatedSession(currentUserId);
        String sessionId = session.getId();

        MvcResult result = mockMvc.perform(put("/api/users/me/password")
                        .session(session)
                        .header(HttpHeaders.COOKIE, DOCUMENTED_SESSION_COOKIE)
                        .param("userId", otherUserId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "currentPassword": "wish",
                                  "newPassword": "magic"
                                }
                                """))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""))
                .andDo(document(
                        "users-change-password",
                        resource(ResourceSnippetParameters.builder()
                                .tag("User")
                                .summary("비밀번호 변경")
                                .description(CHANGE_PASSWORD_DESCRIPTION)
                                .requestSchema(schema("ChangePasswordRequest"))
                                .requestHeaders(
                                        headerWithName(HttpHeaders.COOKIE)
                                                .description("로그인 시 발급된 JSESSIONID Session Cookie")
                                )
                                .requestFields(
                                        fieldWithPath("currentPassword").description("본인 확인을 위한 현재 비밀번호"),
                                        fieldWithPath("newPassword").description("새 비밀번호(4자 이상 20자 이하)")
                                )
                                .build())
                ))
                .andReturn();

        assertThat(session.isInvalid()).isFalse();
        assertThat(session.getId()).isEqualTo(sessionId);
        assertThat(session.getAttribute(AuthSession.USER_ID_ATTRIBUTE)).isEqualTo(currentUserId);
        assertThat(result.getResponse().getContentAsString())
                .doesNotContain(PASSWORD)
                .doesNotContain(NEW_PASSWORD);

        mockMvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest("current", NEW_PASSWORD))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(currentUserId));

        mockMvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest("current", PASSWORD))))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest("other", PASSWORD))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(otherUserId));
    }

    @Test
    @DisplayName("현재 비밀번호가 일치하지 않으면 기존 비밀번호를 유지한다")
    void shouldKeepCurrentPasswordWhenCurrentPasswordDoesNotMatch(CapturedOutput output) throws Exception {
        MvcResult result = mockMvc.perform(put("/api/users/me/password")
                        .session(authenticatedSession(currentUserId))
                        .header(HttpHeaders.COOKIE, DOCUMENTED_SESSION_COOKIE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "currentPassword": "incorrect-current",
                                  "newPassword": "magic"
                                }
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(202))
                .andExpect(jsonPath("$.message").value("인증 정보가 올바르지 않습니다."))
                .andDo(document(
                        "users-change-password-current-password-mismatch",
                        resource(ResourceSnippetParameters.builder()
                                .tag("User")
                                .summary("비밀번호 변경")
                                .description(CHANGE_PASSWORD_DESCRIPTION)
                                .requestSchema(schema("ChangePasswordRequest"))
                                .responseSchema(schema("ErrorResponse"))
                                .requestHeaders(
                                        headerWithName(HttpHeaders.COOKIE)
                                                .description("로그인 시 발급된 JSESSIONID Session Cookie")
                                )
                                .requestFields(
                                        fieldWithPath("currentPassword").description("본인 확인을 위한 현재 비밀번호"),
                                        fieldWithPath("newPassword").description("새 비밀번호(4자 이상 20자 이하)")
                                )
                                .responseFields(
                                        fieldWithPath("errorCode").description("오류 코드"),
                                        fieldWithPath("message").description("오류 메시지")
                                )
                                .build())
                ))
                .andReturn();

        assertThat(result.getResponse().getContentAsString())
                .doesNotContain("incorrect-current")
                .doesNotContain(NEW_PASSWORD);
        assertThat(output)
                .doesNotContain("incorrect-current")
                .doesNotContain(NEW_PASSWORD);

        mockMvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest("current", PASSWORD))))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest("current", NEW_PASSWORD))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("새 비밀번호가 기존 비밀번호와 같으면 저장하지 않고 성공한다")
    void shouldSucceedWithoutUpdatingWhenNewPasswordIsSameAsCurrentPassword() throws Exception {
        MockHttpSession session = authenticatedSession(currentUserId);

        mockMvc.perform(put("/api/users/me/password")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "currentPassword": "wish",
                                  "newPassword": "wish"
                                }
                                """))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));

        assertThat(session.isInvalid()).isFalse();
        assertThat(session.getAttribute(AuthSession.USER_ID_ATTRIBUTE)).isEqualTo(currentUserId);

        mockMvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest("current", PASSWORD))))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("현재 비밀번호가 없거나 새 비밀번호가 회원가입 정책에 맞지 않으면 변경하지 않는다")
    void shouldRejectInvalidPasswordChangeRequestWithoutUpdating() throws Exception {
        mockMvc.perform(put("/api/users/me/password")
                        .session(authenticatedSession(currentUserId))
                        .header(HttpHeaders.COOKIE, DOCUMENTED_SESSION_COOKIE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "currentPassword": "",
                                  "newPassword": "123"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(101))
                .andExpect(jsonPath("$.message").value("요청 값이 올바르지 않습니다."))
                .andExpect(jsonPath("$.errors.length()").value(2))
                .andExpect(jsonPath("$.errors[*].field", containsInAnyOrder("currentPassword", "newPassword")))
                .andExpect(jsonPath("$.errors[*].message", containsInAnyOrder(
                        "현재 비밀번호는 비어 있을 수 없습니다.",
                        "비밀번호는 4자 이상 20자 이하여야 합니다."
                )))
                .andDo(document(
                        "users-change-password-invalid-request",
                        resource(ResourceSnippetParameters.builder()
                                .tag("User")
                                .summary("비밀번호 변경")
                                .description(CHANGE_PASSWORD_DESCRIPTION)
                                .requestSchema(schema("ChangePasswordRequest"))
                                .responseSchema(schema("ValidationErrorResponse"))
                                .requestHeaders(
                                        headerWithName(HttpHeaders.COOKIE)
                                                .description("로그인 시 발급된 JSESSIONID Session Cookie")
                                )
                                .requestFields(
                                        fieldWithPath("currentPassword").description("본인 확인을 위한 현재 비밀번호"),
                                        fieldWithPath("newPassword").description("새 비밀번호(4자 이상 20자 이하)")
                                )
                                .responseFields(
                                        fieldWithPath("errorCode").description("오류 코드"),
                                        fieldWithPath("message").description("오류 메시지"),
                                        fieldWithPath("errors").description("요청 필드별 검증 오류 목록"),
                                        fieldWithPath("errors[].field").description("검증에 실패한 요청 필드"),
                                        fieldWithPath("errors[].message").description("필드 검증 오류 메시지")
                                )
                                .build())
                ));

        mockMvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest("current", PASSWORD))))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("인증 Session이 없으면 비밀번호를 변경할 수 없다")
    void shouldRequireAuthenticationToChangePassword() throws Exception {
        mockMvc.perform(put("/api/users/me/password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "currentPassword": "wish",
                                  "newPassword": "magic"
                                }
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201))
                .andExpect(jsonPath("$.message").value("로그인이 필요합니다."))
                .andDo(document(
                        "users-change-password-authentication-required",
                        resource(ResourceSnippetParameters.builder()
                                .tag("User")
                                .summary("비밀번호 변경")
                                .description(CHANGE_PASSWORD_DESCRIPTION)
                                .requestSchema(schema("ChangePasswordRequest"))
                                .responseSchema(schema("ErrorResponse"))
                                .requestFields(
                                        fieldWithPath("currentPassword").description("본인 확인을 위한 현재 비밀번호"),
                                        fieldWithPath("newPassword").description("새 비밀번호(4자 이상 20자 이하)")
                                )
                                .responseFields(
                                        fieldWithPath("errorCode").description("오류 코드"),
                                        fieldWithPath("message").description("오류 메시지")
                                )
                                .build())
                ));
    }

    private Long createUser(String nickname) throws Exception {
        CreateUserRequest request = new CreateUserRequest(nickname, PASSWORD);

        String response = mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        return objectMapper.readTree(response).get("id").asLong();
    }

    private MockHttpSession authenticatedSession(Long userId) {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(AuthSession.USER_ID_ATTRIBUTE, userId);
        return session;
    }
}
