package com.bibbidi.wedding.auth.controller;

import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.headerWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.auth.controller.dto.request.LegacyAccountTransferRequest;
import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.auth.oidc.verification.VerifiedOidcUser;
import com.bibbidi.wedding.auth.service.SessionIssueService;
import com.bibbidi.wedding.auth.service.SocialUserRegistrationService;
import com.bibbidi.wedding.auth.service.dto.IssuedSession;
import com.bibbidi.wedding.auth.service.dto.UserAuthInfo;
import com.bibbidi.wedding.support.BibbidiIntegrationTest;
import com.bibbidi.wedding.user.service.UserResult;
import com.bibbidi.wedding.user.service.UserService;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.restdocs.payload.PayloadDocumentation;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.ObjectMapper;

@Sql("/legacy-account-fixture.sql")
class LegacyAccountTransferControllerIntegrationTest extends BibbidiIntegrationTest {

    private static final String REFRESH_COOKIE = "BIBBIDI_REFRESH";
    private static final String LEGACY_NICKNAME = "기존회원";
    private static final String LEGACY_PASSWORD = "bibbidi1234";

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SocialUserRegistrationService socialUserRegistrationService;

    @Autowired
    private SessionIssueService sessionIssueService;

    @Autowired
    private UserService userService;

    private IssuedSession socialSession;

    @BeforeEach
    void setUp() {
        UserAuthInfo created = socialUserRegistrationService.findOrCreate(new VerifiedOidcUser(
                SocialProvider.KAKAO,
                "social-user-1",
                "새회원",
                "new@bibbidi.kr"));
        UserResult active = userService.activate(created.userId());
        UserAuthInfo socialUser = new UserAuthInfo(
                active.id(),
                active.status(),
                active.role(),
                active.nickname(),
                active.email());
        socialSession = sessionIssueService.issueForNewFamily(socialUser, ClientType.WEB);
    }

    @Test
    @DisplayName("기존 회원을 옮기면 기존 회원의 access token을 본문으로 받고 refresh token은 쿠키로 받는다")
    void shouldGiveLegacyUserSession() throws Exception {
        LegacyAccountTransferRequest request = new LegacyAccountTransferRequest(LEGACY_NICKNAME, LEGACY_PASSWORD);

        MvcResult result = mockMvc.perform(post("/api/users/me/legacy-account-transfer")
                        .header(AUTHORIZATION, "Bearer " + socialSession.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.termsAgreementRequired").value(false))
                .andDo(document(
                        "auth-legacy-account-transfer",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Auth")
                                .summary("기존 회원 옮기기")
                                .description("비밀번호로 가입했던 회원의 닉네임과 비밀번호를 확인하고, "
                                        + "지금 로그인한 소셜 계정을 그 회원에게 잇습니다. "
                                        + "소셜 로그인으로 새로 생긴 회원은 지우고 기존 회원의 세션을 새로 발급합니다. "
                                        + "refresh token은 쿠키로 내려갑니다.")
                                .requestSchema(schema("LegacyAccountTransferRequest"))
                                .responseSchema(schema("BibbidiSessionResponse"))
                                .requestHeaders(headerWithName(AUTHORIZATION)
                                        .description("소셜 로그인으로 받은 access token"))
                                .requestFields(
                                        PayloadDocumentation.fieldWithPath("nickname")
                                                .description("비밀번호 로그인에 쓰던 닉네임"),
                                        PayloadDocumentation.fieldWithPath("password")
                                                .description("비밀번호 로그인에 쓰던 비밀번호"))
                                .responseFields(
                                        PayloadDocumentation.fieldWithPath("accessToken")
                                                .description("기존 회원으로 API를 호출할 때 싣는 access token"),
                                        PayloadDocumentation.fieldWithPath("termsAgreementRequired")
                                                .description("약관에 동의해야 서비스를 쓸 수 있는 상태인지"))
                                .build())))
                .andReturn();

        assertThat(result.getResponse().getHeader("Set-Cookie")).contains(REFRESH_COOKIE);
        mockMvc.perform(get("/api/users/me")
                        .header(AUTHORIZATION, "Bearer " + accessTokenOf(result)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname").value(LEGACY_NICKNAME));
    }

    @Test
    @DisplayName("기존 회원의 닉네임이나 비밀번호가 틀리면 인증 실패로 응답한다")
    void shouldRejectWrongPassword() throws Exception {
        LegacyAccountTransferRequest request = new LegacyAccountTransferRequest(LEGACY_NICKNAME, "wrong-password");

        mockMvc.perform(post("/api/users/me/legacy-account-transfer")
                        .header(AUTHORIZATION, "Bearer " + socialSession.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(202));
    }

    private String accessTokenOf(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("accessToken").asString();
    }
}
