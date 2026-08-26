package com.bibbidi.wedding.auth.controller;

import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.headerWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.documentationConfiguration;
import static org.springframework.restdocs.operation.preprocess.Preprocessors.modifyHeaders;
import static org.springframework.restdocs.operation.preprocess.Preprocessors.preprocessResponse;
import static org.springframework.restdocs.payload.PayloadDocumentation.fieldWithPath;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

import com.bibbidi.wedding.auth.session.AuthSession;
import com.bibbidi.wedding.auth.password.PasswordHasher;
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
import org.springframework.restdocs.RestDocumentationContextProvider;
import org.springframework.restdocs.RestDocumentationExtension;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@ExtendWith({OutputCaptureExtension.class, RestDocumentationExtension.class})
class AuthControllerIntegrationTest {

    private static final String NICKNAME = "bibbidi";
    private static final String PASSWORD = "wish";
    private static final String LOGIN_DESCRIPTION =
            "닉네임과 비밀번호를 검증하고 인증 세션을 생성합니다. "
                    + "성공 시 JSESSIONID Session Cookie를 발급하며, "
                    + "이후 인증이 필요한 요청은 발급된 JSESSIONID Cookie를 그대로 전송합니다.";
    private static final String DOCUMENTED_SESSION_COOKIE =
            "JSESSIONID=<session-id>; Path=/; Secure; HttpOnly; SameSite=Lax";

    @Autowired
    private WebApplicationContext context;

    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordHasher passwordHasher;

    private User user;

    @BeforeEach
    void setUp(RestDocumentationContextProvider restDocumentation) {
        mockMvc = webAppContextSetup(context)
                .apply(documentationConfiguration(restDocumentation))
                .build();
        user = userRepository.save(User.create(NICKNAME, passwordHasher.hash(PASSWORD)));
    }

    @Test
    @DisplayName("올바른 인증 정보로 로그인하면 기존 세션을 교체하고 사용자 ID를 저장한다")
    void shouldReplaceSessionAndStoreUserIdWhenCredentialsAreValid(CapturedOutput output) throws Exception {
        MockHttpSession previousSession = new MockHttpSession();
        String previousSessionId = previousSession.getId();

        MvcResult result = mockMvc.perform(loginRequest(PASSWORD).session(previousSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(user.id()))
                .andExpect(jsonPath("$.nickname").value(NICKNAME))
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.sessionId").doesNotExist())
                .andDo(document(
                        "auth-login",
                        preprocessResponse(modifyHeaders().set(
                                HttpHeaders.SET_COOKIE,
                                DOCUMENTED_SESSION_COOKIE
                        )),
                        resource(ResourceSnippetParameters.builder()
                                .tag("Authentication")
                                .summary("로그인")
                                .description(LOGIN_DESCRIPTION)
                                .requestSchema(schema("LoginRequest"))
                                .responseSchema(schema("LoginResponse"))
                                .requestFields(
                                        fieldWithPath("nickname").description("가입한 사용자 닉네임"),
                                        fieldWithPath("password").description("사용자 비밀번호")
                                )
                                .responseFields(
                                        fieldWithPath("userId").description("로그인한 사용자 ID"),
                                        fieldWithPath("nickname").description("로그인한 사용자 닉네임")
                                )
                                .responseHeaders(
                                        headerWithName(HttpHeaders.SET_COOKIE)
                                                .description("인증에 사용할 JSESSIONID Session Cookie "
                                                        + "(Path=/; Secure; HttpOnly; SameSite=Lax)")
                                )
                                .build())
                ))
                .andReturn();

        MockHttpSession authenticatedSession = (MockHttpSession) result.getRequest().getSession(false);

        assertThat(previousSession.isInvalid()).isTrue();
        assertThat(authenticatedSession).isNotNull();
        assertThat(authenticatedSession.getId()).isNotEqualTo(previousSessionId);
        assertThat(authenticatedSession.getAttribute(AuthSession.USER_ID_ATTRIBUTE))
                .isEqualTo(user.id());
        assertThat(result.getResponse().getContentAsString())
                .doesNotContain(PASSWORD)
                .doesNotContain(user.passwordHash());
        assertThat(output)
                .doesNotContain(PASSWORD)
                .doesNotContain(user.passwordHash())
                .doesNotContain("sessionId=");
    }

    @Test
    @DisplayName("존재하지 않는 닉네임과 잘못된 비밀번호는 동일한 인증 실패를 반환한다")
    void shouldReturnSameFailureForUnknownNicknameAndWrongPassword(CapturedOutput output) throws Exception {
        MvcResult unknownNickname = mockMvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "unknown",
                                  "password": "unknown-password"
                                }
                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(202))
                .andExpect(jsonPath("$.message").value("인증 정보가 올바르지 않습니다."))
                .andExpect(jsonPath("$.status").doesNotExist())
                .andExpect(jsonPath("$.type").doesNotExist())
                .andExpect(jsonPath("$.detail").doesNotExist())
                .andExpect(result -> assertThat(result.getRequest().getSession(false)).isNull())
                .andDo(document(
                        "auth-login-failed",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Authentication")
                                .summary("로그인")
                                .description(LOGIN_DESCRIPTION)
                                .requestSchema(schema("LoginRequest"))
                                .responseSchema(schema("ErrorResponse"))
                                .requestFields(
                                        fieldWithPath("nickname").description("가입한 사용자 닉네임"),
                                        fieldWithPath("password").description("사용자 비밀번호")
                                )
                                .responseFields(
                                        fieldWithPath("errorCode").description("오류 코드"),
                                        fieldWithPath("message").description("오류 메시지")
                                )
                                .build())
                ))
                .andReturn();

        MvcResult wrongPassword = mockMvc.perform(loginRequest("wrong-password"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(202))
                .andExpect(jsonPath("$.message").value("인증 정보가 올바르지 않습니다."))
                .andExpect(jsonPath("$.status").doesNotExist())
                .andExpect(jsonPath("$.type").doesNotExist())
                .andExpect(jsonPath("$.detail").doesNotExist())
                .andExpect(result -> assertThat(result.getRequest().getSession(false)).isNull())
                .andReturn();

        assertThat(unknownNickname.getResponse().getContentAsString())
                .isEqualTo(wrongPassword.getResponse().getContentAsString())
                .doesNotContain("unknown-password")
                .doesNotContain("wrong-password")
                .doesNotContain(user.passwordHash());
        assertThat(output)
                .contains("errorCode=202")
                .contains("status=401")
                .doesNotContain("unknown-password")
                .doesNotContain("wrong-password")
                .doesNotContain(user.passwordHash());
    }

    @Test
    @DisplayName("로그인 입력이 유효하지 않으면 세션을 생성하지 않고 요청을 거절한다")
    void shouldRejectInvalidLoginRequestWithoutCreatingSession() throws Exception {
        mockMvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "",
                                  "password": "123"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(101))
                .andExpect(jsonPath("$.message").value("요청 값이 올바르지 않습니다."))
                .andExpect(jsonPath("$.status").doesNotExist())
                .andExpect(jsonPath("$.errors.length()").value(2))
                .andExpect(jsonPath("$.errors[*].field", containsInAnyOrder("nickname", "password")))
                .andExpect(result -> assertThat(result.getRequest().getSession(false)).isNull())
                .andDo(document(
                        "auth-login-invalid-request",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Authentication")
                                .summary("로그인")
                                .description(LOGIN_DESCRIPTION)
                                .requestSchema(schema("LoginRequest"))
                                .responseSchema(schema("ValidationErrorResponse"))
                                .requestFields(
                                        fieldWithPath("nickname").description("가입한 사용자 닉네임"),
                                        fieldWithPath("password").description("사용자 비밀번호")
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
    @DisplayName("로그아웃하면 현재 세션을 무효화한다")
    void shouldInvalidateCurrentSessionWhenLoggingOut(CapturedOutput output) throws Exception {
        MvcResult loginResult = mockMvc.perform(loginRequest(PASSWORD))
                .andExpect(status().isOk())
                .andReturn();
        MockHttpSession authenticatedSession = (MockHttpSession) loginResult.getRequest().getSession(false);

        mockMvc.perform(delete("/api/logout").session(authenticatedSession))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""))
                .andDo(document(
                        "auth-logout",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Authentication")
                                .summary("로그아웃")
                                .description("현재 인증 세션을 무효화하고 JSESSIONID Cookie를 만료시킵니다.")
                                .responseHeaders(
                                        headerWithName(HttpHeaders.SET_COOKIE)
                                                .description("즉시 만료되는 JSESSIONID Session Cookie")
                                )
                                .build())
                ));

        assertThat(authenticatedSession.isInvalid()).isTrue();
        assertThat(output).doesNotContain("sessionId=");
    }

    private MockHttpServletRequestBuilder loginRequest(String password) {
        return post("/api/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "nickname": "%s",
                          "password": "%s"
                        }
                        """.formatted(NICKNAME, password));
    }
}
