package com.bibbidi.wedding.user.controller;

import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.headerWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.parameterWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.documentationConfiguration;
import static org.springframework.restdocs.payload.PayloadDocumentation.fieldWithPath;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

import com.bibbidi.wedding.auth.controller.dto.CreateUserRequest;
import com.bibbidi.wedding.auth.controller.dto.LoginRequest;
import com.bibbidi.wedding.auth.session.AuthSession;
import com.bibbidi.wedding.user.controller.dto.ChangeNicknameRequest;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.restdocs.RestDocumentationContextProvider;
import org.springframework.restdocs.RestDocumentationExtension;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@ExtendWith(RestDocumentationExtension.class)
class UserControllerIntegrationTest {

    private static final String PASSWORD = "wish";
    private static final String DOCUMENTED_SESSION_COOKIE = "JSESSIONID=<session-id>";
    private static final String CHANGE_NICKNAME_DESCRIPTION = "현재 인증 Session의 사용자 ID를 유지하면서 로그인에 사용할 닉네임을 변경합니다. 닉네임 중복은 영문 대소문자를 구분하지 않습니다.";
    private static final String NICKNAME_AVAILABILITY_DESCRIPTION = "회원가입 화면에서 닉네임을 확정하기 전에 사용할 수 있는 닉네임인지 미리 확인합니다. 닉네임 중복은 영문 대소문자를 구분하지 않습니다. 확인 이후 다른 요청이 같은 닉네임을 선점할 수 있으므로 최종 판단은 회원가입 응답이 합니다.";

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
    @DisplayName("현재 사용자의 닉네임을 변경하고 사용자와 Session을 유지한다")
    void shouldChangeCurrentUserNicknameAndKeepIdentityAndSession() throws Exception {
        ChangeNicknameRequest changeNicknameRequest = new ChangeNicknameRequest("new-name");
        LoginRequest changedNicknameLoginRequest = new LoginRequest("new-name", PASSWORD);
        LoginRequest previousNicknameLoginRequest = new LoginRequest("current", PASSWORD);
        MockHttpSession session = authenticatedSession(currentUserId);

        mockMvc.perform(put("/api/users/me/nickname")
                        .session(session)
                        .header(HttpHeaders.COOKIE, DOCUMENTED_SESSION_COOKIE)
                        .param("userId", otherUserId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(changeNicknameRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(currentUserId))
                .andExpect(jsonPath("$.nickname").value("new-name"))
                .andExpect(jsonPath("$.password").doesNotExist())
                .andDo(document(
                        "users-change-nickname",
                        resource(ResourceSnippetParameters.builder()
                                .tag("User")
                                .summary("닉네임 변경")
                                .description(CHANGE_NICKNAME_DESCRIPTION)
                                .requestSchema(schema("ChangeNicknameRequest"))
                                .responseSchema(schema("ChangeNicknameResponse"))
                                .requestHeaders(
                                        headerWithName(HttpHeaders.COOKIE)
                                                .description("로그인 시 발급된 JSESSIONID Session Cookie")
                                )
                                .requestFields(
                                        fieldWithPath("nickname").description("새 로그인 닉네임")
                                )
                                .responseFields(
                                        fieldWithPath("id").description("변경되지 않은 사용자 ID"),
                                        fieldWithPath("nickname").description("변경된 사용자 닉네임")
                                )
                                .build())
                ));
        mockMvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(changedNicknameLoginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(currentUserId))
                .andExpect(jsonPath("$.nickname").value("new-name"));

        mockMvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(previousNicknameLoginRequest)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("다른 사용자의 닉네임과 대소문자만 달라도 변경을 거절한다")
    void shouldRejectNicknameUsedByAnotherUserIgnoringCase() throws Exception {
        createUser("Taken");
        ChangeNicknameRequest request = new ChangeNicknameRequest("taken");

        mockMvc.perform(put("/api/users/me/nickname")
                        .session(authenticatedSession(currentUserId))
                        .header(HttpHeaders.COOKIE, DOCUMENTED_SESSION_COOKIE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value(401))
                .andExpect(jsonPath("$.message").value("이미 사용 중인 닉네임입니다."))
                .andDo(document(
                        "users-change-nickname-conflict",
                        resource(ResourceSnippetParameters.builder()
                                .tag("User")
                                .summary("닉네임 변경")
                                .description(CHANGE_NICKNAME_DESCRIPTION)
                                .requestSchema(schema("ChangeNicknameRequest"))
                                .responseSchema(schema("ErrorResponse"))
                                .requestHeaders(
                                        headerWithName(HttpHeaders.COOKIE)
                                                .description("로그인 시 발급된 JSESSIONID Session Cookie")
                                )
                                .requestFields(
                                        fieldWithPath("nickname").description("새 로그인 닉네임")
                                )
                                .responseFields(
                                        fieldWithPath("errorCode").description("오류 코드"),
                                        fieldWithPath("message").description("오류 메시지")
                                )
                                .build())
                ));
    }

    @Test
    @DisplayName("회원가입 정책보다 긴 닉네임은 변경을 거절한다")
    void shouldRejectNicknameThatDoesNotMeetRegistrationPolicy() throws Exception {
        ChangeNicknameRequest request = new ChangeNicknameRequest("12345678901");

        mockMvc.perform(put("/api/users/me/nickname")
                        .session(authenticatedSession(currentUserId))
                        .header(HttpHeaders.COOKIE, DOCUMENTED_SESSION_COOKIE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(101))
                .andExpect(jsonPath("$.message").value("요청 값이 올바르지 않습니다."))
                .andExpect(jsonPath("$.errors[0].field").value("nickname"))
                .andExpect(jsonPath("$.errors[0].message").value("닉네임은 10자 이하여야 합니다."))
                .andDo(document(
                        "users-change-nickname-invalid-request",
                        resource(ResourceSnippetParameters.builder()
                                .tag("User")
                                .summary("닉네임 변경")
                                .description(CHANGE_NICKNAME_DESCRIPTION)
                                .requestSchema(schema("ChangeNicknameRequest"))
                                .responseSchema(schema("ValidationErrorResponse"))
                                .requestHeaders(
                                        headerWithName(HttpHeaders.COOKIE)
                                                .description("로그인 시 발급된 JSESSIONID Session Cookie")
                                )
                                .requestFields(
                                        fieldWithPath("nickname").description("새 로그인 닉네임")
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
    }

    @Test
    @DisplayName("인증 Session이 없으면 닉네임을 변경할 수 없다")
    void shouldRequireAuthenticationToChangeNickname() throws Exception {
        ChangeNicknameRequest request = new ChangeNicknameRequest("new-name");

        mockMvc.perform(put("/api/users/me/nickname")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201))
                .andExpect(jsonPath("$.message").value("로그인이 필요합니다."))
                .andDo(document(
                        "users-change-nickname-authentication-required",
                        resource(ResourceSnippetParameters.builder()
                                .tag("User")
                                .summary("닉네임 변경")
                                .description(CHANGE_NICKNAME_DESCRIPTION)
                                .requestSchema(schema("ChangeNicknameRequest"))
                                .responseSchema(schema("ErrorResponse"))
                                .requestFields(
                                        fieldWithPath("nickname").description("새 로그인 닉네임")
                                )
                                .responseFields(
                                        fieldWithPath("errorCode").description("오류 코드"),
                                        fieldWithPath("message").description("오류 메시지")
                                )
                                .build())
                ));
    }

    @Test
    @DisplayName("아무도 쓰지 않는 닉네임은 사용할 수 있다고 알려준다")
    void shouldReportNicknameAsAvailableWhenNobodyUsesIt() throws Exception {
        mockMvc.perform(get("/api/users/nickname/availability")
                        .queryParam("nickname", "bibbidi"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname").value("bibbidi"))
                .andExpect(jsonPath("$.available").value(true))
                .andDo(document(
                        "users-nickname-availability",
                        resource(ResourceSnippetParameters.builder()
                                .tag("User")
                                .summary("닉네임 중복 확인")
                                .description(NICKNAME_AVAILABILITY_DESCRIPTION)
                                .responseSchema(schema("NicknameAvailabilityResponse"))
                                .queryParameters(
                                        parameterWithName("nickname").description("사용 가능 여부를 확인할 닉네임")
                                )
                                .responseFields(
                                        fieldWithPath("nickname").description("확인을 요청한 닉네임"),
                                        fieldWithPath("available").description("사용할 수 있으면 true")
                                )
                                .build())
                ));
    }

    @Test
    @DisplayName("다른 사용자의 닉네임과 대소문자만 달라도 사용할 수 없다고 알려준다")
    void shouldReportNicknameAsUnavailableIgnoringCase() throws Exception {
        createUser("Taken");

        mockMvc.perform(get("/api/users/nickname/availability")
                        .queryParam("nickname", "taken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname").value("taken"))
                .andExpect(jsonPath("$.available").value(false))
                .andDo(document(
                        "users-nickname-availability-taken",
                        resource(ResourceSnippetParameters.builder()
                                .tag("User")
                                .summary("닉네임 중복 확인")
                                .description(NICKNAME_AVAILABILITY_DESCRIPTION)
                                .responseSchema(schema("NicknameAvailabilityResponse"))
                                .queryParameters(
                                        parameterWithName("nickname").description("사용 가능 여부를 확인할 닉네임")
                                )
                                .responseFields(
                                        fieldWithPath("nickname").description("확인을 요청한 닉네임"),
                                        fieldWithPath("available").description("사용할 수 있으면 true")
                                )
                                .build())
                ));
    }

    @Test
    @DisplayName("회원가입 정책보다 긴 닉네임은 중복 확인을 거절한다")
    void shouldRejectNicknameAvailabilityCheckThatDoesNotMeetRegistrationPolicy() throws Exception {
        mockMvc.perform(get("/api/users/nickname/availability")
                        .queryParam("nickname", "12345678901"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(101))
                .andExpect(jsonPath("$.message").value("요청 값이 올바르지 않습니다."))
                .andExpect(jsonPath("$.errors[0].field").value("nickname"))
                .andExpect(jsonPath("$.errors[0].message").value("닉네임은 10자 이하여야 합니다."))
                .andDo(document(
                        "users-nickname-availability-invalid-request",
                        resource(ResourceSnippetParameters.builder()
                                .tag("User")
                                .summary("닉네임 중복 확인")
                                .description(NICKNAME_AVAILABILITY_DESCRIPTION)
                                .responseSchema(schema("ValidationErrorResponse"))
                                .queryParameters(
                                        parameterWithName("nickname").description("사용 가능 여부를 확인할 닉네임")
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
