package com.bibbidi.wedding.user.controller;

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

import com.bibbidi.wedding.auth.password.PasswordHasher;
import com.bibbidi.wedding.auth.session.AuthSession;
import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.repository.UserRepository;
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

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@ExtendWith({OutputCaptureExtension.class, RestDocumentationExtension.class})
class UserControllerIntegrationTest {

    private static final String PASSWORD = "wish";
    private static final String NEW_PASSWORD = "magic";
    private static final String DOCUMENTED_SESSION_COOKIE = "JSESSIONID=<session-id>";
    private static final String CHANGE_NICKNAME_DESCRIPTION =
            "현재 인증 Session의 사용자 ID를 유지하면서 로그인에 사용할 닉네임을 변경합니다.";
    private static final String CHANGE_PASSWORD_DESCRIPTION =
            "현재 인증 Session의 사용자가 현재 비밀번호를 확인한 뒤 새 비밀번호로 변경합니다. "
                    + "비밀번호 변경 후에도 현재 Session은 유지됩니다.";

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordHasher passwordHasher;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp(RestDocumentationContextProvider restDocumentation) {
        mockMvc = webAppContextSetup(context)
                .apply(documentationConfiguration(restDocumentation))
                .build();
    }

    @Test
    @DisplayName("현재 사용자의 닉네임을 변경하고 사용자와 Session을 유지한다")
    void shouldChangeCurrentUserNicknameAndKeepIdentityAndSession() throws Exception {
        User currentUser = saveUser("bibbidi");
        User otherUser = saveUser("other");
        String passwordHash = currentUser.passwordHash();
        MockHttpSession session = authenticatedSession(currentUser.id());
        String sessionId = session.getId();

        mockMvc.perform(put("/api/users/me/nickname")
                        .session(session)
                        .header(HttpHeaders.COOKIE, DOCUMENTED_SESSION_COOKIE)
                        .param("userId", otherUser.id().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "new-name"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(currentUser.id()))
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

        User updatedUser = userRepository.findByNickname("NEW-NAME");
        User unchangedOtherUser = userRepository.findById(otherUser.id());

        assertThat(updatedUser.id()).isEqualTo(currentUser.id());
        assertThat(updatedUser.passwordHash()).isEqualTo(passwordHash);
        assertThat(unchangedOtherUser.nickname()).isEqualTo("other");
        assertThat(session.isInvalid()).isFalse();
        assertThat(session.getId()).isEqualTo(sessionId);
        assertThat(session.getAttribute(AuthSession.USER_ID_ATTRIBUTE)).isEqualTo(currentUser.id());

        mockMvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "new-name",
                                  "password": "wish"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(currentUser.id()))
                .andExpect(jsonPath("$.nickname").value("new-name"));

        mockMvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "bibbidi",
                                  "password": "wish"
                                }
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("다른 사용자의 닉네임과 대소문자만 달라도 변경을 거절한다")
    void shouldRejectNicknameUsedByAnotherUserIgnoringCase() throws Exception {
        User currentUser = saveUser("current");
        saveUser("Taken");

        mockMvc.perform(put("/api/users/me/nickname")
                        .session(authenticatedSession(currentUser.id()))
                        .header(HttpHeaders.COOKIE, DOCUMENTED_SESSION_COOKIE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "taken"
                                }
                                """))
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

        assertThat(userRepository.findById(currentUser.id()).nickname()).isEqualTo("current");
    }

    @Test
    @DisplayName("회원가입 정책보다 긴 닉네임은 변경을 거절한다")
    void shouldRejectNicknameThatDoesNotMeetRegistrationPolicy() throws Exception {
        User currentUser = saveUser("current");

        mockMvc.perform(put("/api/users/me/nickname")
                        .session(authenticatedSession(currentUser.id()))
                        .header(HttpHeaders.COOKIE, DOCUMENTED_SESSION_COOKIE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "12345678901"
                                }
                                """))
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

        assertThat(userRepository.findById(currentUser.id()).nickname()).isEqualTo("current");
    }

    @Test
    @DisplayName("인증 Session이 없으면 닉네임을 변경할 수 없다")
    void shouldRequireAuthenticationToChangeNickname() throws Exception {
        mockMvc.perform(put("/api/users/me/nickname")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "new-name"
                                }
                                """))
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
    @DisplayName("현재 사용자의 비밀번호를 변경하고 현재 Session을 유지한다")
    void shouldChangeCurrentUserPasswordAndKeepSession() throws Exception {
        User currentUser = saveUser("current");
        User otherUser = saveUser("other");
        String currentPasswordHash = currentUser.passwordHash();
        String otherPasswordHash = otherUser.passwordHash();
        MockHttpSession session = authenticatedSession(currentUser.id());
        String sessionId = session.getId();

        MvcResult result = mockMvc.perform(put("/api/users/me/password")
                        .session(session)
                        .header(HttpHeaders.COOKIE, DOCUMENTED_SESSION_COOKIE)
                        .param("userId", otherUser.id().toString())
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

        User updatedUser = userRepository.findById(currentUser.id());
        User unchangedOtherUser = userRepository.findById(otherUser.id());

        assertThat(updatedUser.passwordHash())
                .isNotEqualTo(currentPasswordHash)
                .isNotEqualTo(NEW_PASSWORD);
        assertThat(passwordHasher.matches(NEW_PASSWORD, updatedUser.passwordHash())).isTrue();
        assertThat(passwordHasher.matches(PASSWORD, updatedUser.passwordHash())).isFalse();
        assertThat(unchangedOtherUser.passwordHash()).isEqualTo(otherPasswordHash);
        assertThat(session.isInvalid()).isFalse();
        assertThat(session.getId()).isEqualTo(sessionId);
        assertThat(session.getAttribute(AuthSession.USER_ID_ATTRIBUTE)).isEqualTo(currentUser.id());
        assertThat(result.getResponse().getContentAsString())
                .doesNotContain(PASSWORD)
                .doesNotContain(NEW_PASSWORD)
                .doesNotContain(updatedUser.passwordHash());

        mockMvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "current",
                                  "password": "magic"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(currentUser.id()));

        mockMvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "current",
                                  "password": "wish"
                                }
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("현재 비밀번호가 일치하지 않으면 기존 비밀번호를 유지한다")
    void shouldKeepCurrentPasswordWhenCurrentPasswordDoesNotMatch(CapturedOutput output) throws Exception {
        User currentUser = saveUser("current");
        String currentPasswordHash = currentUser.passwordHash();

        MvcResult result = mockMvc.perform(put("/api/users/me/password")
                        .session(authenticatedSession(currentUser.id()))
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

        assertThat(userRepository.findById(currentUser.id()).passwordHash()).isEqualTo(currentPasswordHash);
        assertThat(result.getResponse().getContentAsString())
                .doesNotContain("incorrect-current")
                .doesNotContain(NEW_PASSWORD)
                .doesNotContain(currentPasswordHash);
        assertThat(output)
                .doesNotContain("incorrect-current")
                .doesNotContain(NEW_PASSWORD)
                .doesNotContain(currentPasswordHash);
    }

    @Test
    @DisplayName("새 비밀번호가 기존 비밀번호와 같으면 저장하지 않고 성공한다")
    void shouldSucceedWithoutUpdatingWhenNewPasswordIsSameAsCurrentPassword() throws Exception {
        User currentUser = saveUser("current");
        String currentPasswordHash = currentUser.passwordHash();
        MockHttpSession session = authenticatedSession(currentUser.id());

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

        assertThat(userRepository.findById(currentUser.id()).passwordHash()).isEqualTo(currentPasswordHash);
        assertThat(session.isInvalid()).isFalse();
        assertThat(session.getAttribute(AuthSession.USER_ID_ATTRIBUTE)).isEqualTo(currentUser.id());
    }

    @Test
    @DisplayName("현재 비밀번호가 없거나 새 비밀번호가 회원가입 정책에 맞지 않으면 변경하지 않는다")
    void shouldRejectInvalidPasswordChangeRequestWithoutUpdating() throws Exception {
        User currentUser = saveUser("current");
        String currentPasswordHash = currentUser.passwordHash();

        mockMvc.perform(put("/api/users/me/password")
                        .session(authenticatedSession(currentUser.id()))
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

        assertThat(userRepository.findById(currentUser.id()).passwordHash()).isEqualTo(currentPasswordHash);
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

    private User saveUser(String nickname) {
        return userRepository.save(User.create(nickname, passwordHasher.hash(PASSWORD)));
    }

    private MockHttpSession authenticatedSession(Long userId) {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(AuthSession.USER_ID_ATTRIBUTE, userId);
        return session;
    }
}
