package com.bibbidi.wedding.user.controller;

import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.headerWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.restdocs.payload.PayloadDocumentation.fieldWithPath;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.auth.controller.dto.ChangePasswordRequest;
import com.bibbidi.wedding.auth.controller.dto.CreateUserRequest;
import com.bibbidi.wedding.auth.controller.dto.LoginRequest;
import com.bibbidi.wedding.auth.session.AuthSession;
import com.bibbidi.wedding.support.BibbidiIntegrationTest;
import com.bibbidi.wedding.user.controller.dto.ChangeNicknameRequest;
import com.bibbidi.wedding.user.controller.dto.WeddingDateRequest;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import tools.jackson.databind.ObjectMapper;

class UserControllerIntegrationTest extends BibbidiIntegrationTest {

    private static final String PASSWORD = "wish";
    private static final String DOCUMENTED_SESSION_COOKIE = "JSESSIONID=<session-id>";
    private static final String CURRENT_USER_DESCRIPTION =
            "현재 인증 Session의 사용자 ID로 계정 정보를 조회합니다. "
                    + "Session이 없으면 인증 필요 오류를, DB에 사용자가 없으면 사용자 없음 오류를 반환합니다.";
    private static final String CHANGE_NICKNAME_DESCRIPTION = "현재 인증 Session의 사용자 ID를 유지하면서 로그인에 사용할 닉네임을 변경합니다. 닉네임 중복은 영문 대소문자를 구분하지 않습니다.";
    private static final String WEDDING_DATE_DESCRIPTION =
            "현재 인증 Session 사용자의 결혼 예정일을 저장하거나 변경합니다. 과거 날짜와 동일한 날짜도 허용합니다.";

    @Autowired
    private ObjectMapper objectMapper;
    private Long currentUserId;
    private Long otherUserId;

    @BeforeEach
    void setUp() throws Exception {
        currentUserId = createUser("current");
        otherUserId = createUser("other");
    }

    @Test
    @DisplayName("Session Cookie를 전달받아 현재 사용자의 정보를 조회하여 반환한다")
    void shouldFindCurrentUserFromAuthenticatedSession() throws Exception {
        mockMvc.perform(get("/api/users/me")
                        .session(authenticatedSession(currentUserId))
                        .header(HttpHeaders.COOKIE, DOCUMENTED_SESSION_COOKIE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(currentUserId))
                .andExpect(jsonPath("$.nickname").value("current"))
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.sessionId").doesNotExist())
                .andExpect(jsonPath("$.status").doesNotExist())
                .andDo(document(
                        "users-find-me",
                        resource(ResourceSnippetParameters.builder()
                                .tag("User")
                                .summary("내 정보 조회")
                                .description(CURRENT_USER_DESCRIPTION)
                                .responseSchema(schema("CurrentUserResponse"))
                                .requestHeaders(
                                        headerWithName(HttpHeaders.COOKIE)
                                                .description("로그인 시 발급된 JSESSIONID Session Cookie")
                                )
                                .responseFields(
                                        fieldWithPath("id").description("현재 사용자 ID"),
                                        fieldWithPath("nickname").description("현재 사용자 닉네임")
                                )
                                .build())
                ));
    }

    @Test
    @DisplayName("다른 사용자 ID를 요청 파라미터로 전달해도 Session 사용자의 정보를 반환한다")
    void shouldIgnoreRequestedUserIdAndFindSessionUser() throws Exception {
        mockMvc.perform(get("/api/users/me")
                        .session(authenticatedSession(currentUserId))
                        .queryParam("userId", otherUserId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(currentUserId))
                .andExpect(jsonPath("$.nickname").value("current"));
    }

    @Test
    @DisplayName("Session Cookie 없이 현재 사용자 정보를 요청하면 인증 필요 오류를 반환한다")
    void shouldRequireAuthenticationToFindCurrentUser() throws Exception {
        mockMvc.perform(get("/api/users/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201))
                .andExpect(jsonPath("$.message").value("로그인이 필요합니다."))
                .andExpect(jsonPath("$.status").doesNotExist())
                .andExpect(result -> assertThat(result.getRequest().getSession(false)).isNull())
                .andDo(document(
                        "users-find-me-authentication-required",
                        resource(ResourceSnippetParameters.builder()
                                .tag("User")
                                .summary("내 정보 조회")
                                .description(CURRENT_USER_DESCRIPTION)
                                .responseSchema(schema("ErrorResponse"))
                                .responseFields(
                                        fieldWithPath("errorCode").description("오류 코드"),
                                        fieldWithPath("message").description("오류 메시지")
                                )
                                .build())
                ));
    }

    @Test
    @DisplayName("Session에 저장된 사용자 ID가 DB에 없으면 사용자 없음 오류를 반환한다")
    void shouldReturnUserNotFoundWhenSessionUserDoesNotExist() throws Exception {
        mockMvc.perform(get("/api/users/me")
                        .session(authenticatedSession(Long.MAX_VALUE)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value(301))
                .andExpect(jsonPath("$.message").value("사용자를 찾을 수 없습니다."))
                .andExpect(jsonPath("$.status").doesNotExist())
                .andDo(document(
                        "users-find-me-user-not-found",
                        resource(ResourceSnippetParameters.builder()
                                .tag("User")
                                .summary("내 정보 조회")
                                .description(CURRENT_USER_DESCRIPTION)
                                .responseSchema(schema("ErrorResponse"))
                                .responseFields(
                                        fieldWithPath("errorCode").description("오류 코드"),
                                        fieldWithPath("message").description("오류 메시지")
                                )
                                .build())
                ));
    }

    @Test
    @DisplayName("현재 사용자의 결혼 예정일을 저장하고 조회한다")
    void shouldSaveAndFindCurrentUserWeddingDate() throws Exception {
        WeddingDateRequest request = new WeddingDateRequest(LocalDate.of(2027, 5, 15));
        MockHttpSession session = authenticatedSession(currentUserId);

        mockMvc.perform(put("/api/users/me/wedding-date")
                        .session(session)
                        .header(HttpHeaders.COOKIE, DOCUMENTED_SESSION_COOKIE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weddingDate").value("2027-05-15"))
                .andExpect(jsonPath("$.daysUntilWedding").doesNotExist())
                .andDo(document(
                        "users-update-wedding-date",
                        resource(ResourceSnippetParameters.builder()
                                .tag("User")
                                .summary("결혼 예정일 저장 및 변경")
                                .description(WEDDING_DATE_DESCRIPTION)
                                .requestSchema(schema("WeddingDateRequest"))
                                .responseSchema(schema("WeddingDateResponse"))
                                .requestHeaders(
                                        headerWithName(HttpHeaders.COOKIE)
                                                .description("로그인 시 발급된 JSESSIONID Session Cookie")
                                )
                                .requestFields(
                                        fieldWithPath("weddingDate").description("결혼 예정일(yyyy-MM-dd)")
                                )
                                .responseFields(
                                        fieldWithPath("weddingDate").description("저장된 결혼 예정일(yyyy-MM-dd)")
                                )
                                .build())
                ));

        mockMvc.perform(get("/api/users/me/wedding-date")
                        .session(session)
                        .header(HttpHeaders.COOKIE, DOCUMENTED_SESSION_COOKIE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weddingDate").value("2027-05-15"))
                .andExpect(jsonPath("$.daysUntilWedding").doesNotExist())
                .andDo(document(
                        "users-find-wedding-date",
                        resource(ResourceSnippetParameters.builder()
                                .tag("User")
                                .summary("결혼 예정일 조회")
                                .description("현재 인증 Session 사용자의 결혼 예정일을 조회합니다. 미설정 상태는 null입니다.")
                                .responseSchema(schema("WeddingDateResponse"))
                                .requestHeaders(
                                        headerWithName(HttpHeaders.COOKIE)
                                                .description("로그인 시 발급된 JSESSIONID Session Cookie")
                                )
                                .responseFields(
                                        fieldWithPath("weddingDate").description("설정된 결혼 예정일(yyyy-MM-dd), 미설정 시 null")
                                )
                                .build())
                ));
    }

    @Test
    @DisplayName("결혼 예정일을 설정하지 않은 사용자는 null을 조회한다")
    void shouldFindNullWhenWeddingDateIsNotSet() throws Exception {
        mockMvc.perform(get("/api/users/me/wedding-date")
                        .session(authenticatedSession(currentUserId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weddingDate").value((Object) null))
                .andExpect(jsonPath("$.daysUntilWedding").doesNotExist());
    }

    @Test
    @DisplayName("과거인 동일한 결혼 예정일도 반복해서 저장한다")
    void shouldSaveSamePastWeddingDate() throws Exception {
        WeddingDateRequest request = new WeddingDateRequest(LocalDate.of(2020, 1, 1));
        MockHttpSession session = authenticatedSession(currentUserId);

        mockMvc.perform(put("/api/users/me/wedding-date")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weddingDate").value("2020-01-01"));

        mockMvc.perform(put("/api/users/me/wedding-date")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weddingDate").value("2020-01-01"));
    }

    @Test
    @DisplayName("저장한 결혼 예정일을 다른 날짜로 변경한다")
    void shouldChangeWeddingDate() throws Exception {
        MockHttpSession session = authenticatedSession(currentUserId);

        mockMvc.perform(put("/api/users/me/wedding-date")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new WeddingDateRequest(LocalDate.of(2027, 5, 15))
                        )))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/users/me/wedding-date")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new WeddingDateRequest(LocalDate.of(2028, 6, 16))
                        )))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weddingDate").value("2028-06-16"));

        mockMvc.perform(get("/api/users/me/wedding-date")
                        .session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weddingDate").value("2028-06-16"));
    }

    @Test
    @DisplayName("닉네임과 비밀번호를 변경해도 결혼 예정일을 유지한다")
    void shouldKeepWeddingDateWhenNicknameAndPasswordChange() throws Exception {
        MockHttpSession session = authenticatedSession(currentUserId);

        mockMvc.perform(put("/api/users/me/wedding-date")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new WeddingDateRequest(LocalDate.of(2027, 5, 15))
                        )))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/users/me/nickname")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ChangeNicknameRequest("new-name"))))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/users/me/password")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ChangePasswordRequest(PASSWORD, "magic"))))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/users/me/wedding-date")
                        .session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weddingDate").value("2027-05-15"));
    }

    @Test
    @DisplayName("결혼 예정일이 누락되면 요청을 거절한다")
    void shouldRejectMissingWeddingDate() throws Exception {
        WeddingDateRequest request = new WeddingDateRequest(null);

        mockMvc.perform(put("/api/users/me/wedding-date")
                        .session(authenticatedSession(currentUserId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(101))
                .andExpect(jsonPath("$.message").value("요청 값이 올바르지 않습니다."))
                .andExpect(jsonPath("$.errors[0].field").value("weddingDate"))
                .andExpect(jsonPath("$.errors[0].message").value("결혼 예정일은 비어 있을 수 없습니다."));
    }

    @Test
    @DisplayName("존재하지 않는 날짜는 요청을 거절하고 결혼 예정일을 저장하지 않는다")
    void shouldRejectInvalidWeddingDate() throws Exception {
        MockHttpSession session = authenticatedSession(currentUserId);
        String invalidRequestBody = objectMapper.writeValueAsString(
                new WeddingDateRequest(LocalDate.of(2027, 5, 15))
        ).replace("2027-05-15", "2027-02-30");

        mockMvc.perform(put("/api/users/me/wedding-date")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidRequestBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(101))
                .andExpect(jsonPath("$.message").value("요청 값이 올바르지 않습니다."));

        mockMvc.perform(get("/api/users/me/wedding-date")
                        .session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weddingDate").value((Object) null));
    }

    @Test
    @DisplayName("인증 Session이 없으면 결혼 예정일을 저장하거나 조회할 수 없다")
    void shouldRequireAuthenticationForWeddingDate() throws Exception {
        WeddingDateRequest request = new WeddingDateRequest(LocalDate.of(2027, 5, 15));

        mockMvc.perform(put("/api/users/me/wedding-date")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201))
                .andExpect(jsonPath("$.message").value("로그인이 필요합니다."));

        mockMvc.perform(get("/api/users/me/wedding-date"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201))
                .andExpect(jsonPath("$.message").value("로그인이 필요합니다."));
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
                .andExpect(jsonPath("$.available").value(true));
    }

    @Test
    @DisplayName("다른 사용자의 닉네임과 대소문자만 달라도 사용할 수 없다고 알려준다")
    void shouldReportNicknameAsUnavailableIgnoringCase() throws Exception {
        createUser("Taken");

        mockMvc.perform(get("/api/users/nickname/availability")
                        .queryParam("nickname", "taken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname").value("taken"))
                .andExpect(jsonPath("$.available").value(false));
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
                .andExpect(jsonPath("$.errors[0].message").value("닉네임은 10자 이하여야 합니다."));
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
