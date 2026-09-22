package com.bibbidi.wedding.auth.controller;

import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.headerWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.parameterWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.auth.controller.dto.request.WithdrawalRequest;
import com.bibbidi.wedding.auth.controller.dto.request.SocialLoginRequest;
import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.auth.oidc.client.OidcTokenExchangeClient;
import com.bibbidi.wedding.auth.oidc.verification.IdTokenVerifier;
import com.bibbidi.wedding.auth.oidc.verification.VerifiedOidcUser;
import com.bibbidi.wedding.auth.service.dto.IssuedSession;
import com.bibbidi.wedding.auth.service.SessionIssueService;
import com.bibbidi.wedding.auth.service.SocialUserRegistrationService;
import com.bibbidi.wedding.auth.service.dto.UserAuthInfo;
import com.bibbidi.wedding.auth.token.BibbidiTokenIssuer;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;
import jakarta.servlet.http.Cookie;
import tools.jackson.databind.ObjectMapper;

class WithdrawalControllerIntegrationTest extends BibbidiIntegrationTest {

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SessionIssueService sessionIssueService;

    @Autowired
    private BibbidiTokenIssuer bibbidiTokenIssuer;

    @Autowired
    private UserService userService;

    @Autowired
    private SocialUserRegistrationService socialUserRegistrationService;

    @MockitoBean
    private OidcTokenExchangeClient oidcTokenExchangeClient;

    @MockitoBean
    private IdTokenVerifier idTokenVerifier;

    private IssuedSession session;
    private Long userId;

    @BeforeEach
    void setUp() {
        VerifiedOidcUser identity = new VerifiedOidcUser(
                SocialProvider.KAKAO,
                "social-user-1",
                "current",
                "current@bibbidi.kr"
        );
        UserAuthInfo created = socialUserRegistrationService.findOrCreate(identity);
        UserResult active = userService.activate(created.userId());
        userId = active.id();
        session = sessionIssueService.issueForNewFamily(
                new UserAuthInfo(active.id(), active.status(), active.role(), active.nickname(),
                        active.email()),
                ClientType.WEB);

        given(oidcTokenExchangeClient.exchangeForIdToken(any(), anyString(), anyString(), anyString()))
                .willReturn("id-token");
        given(idTokenVerifier.verify(any(SocialProvider.class), anyString(), anyString()))
                .willReturn(new VerifiedOidcUser(SocialProvider.KAKAO, "social-user-1", "nickname", "current@bibbidi.kr"));
    }

    @Test
    @DisplayName("issues a delete grant after social reauthentication")
    void shouldIssueDeleteGrantAfterSocialReauthentication() throws Exception {
        MvcResult authorization = mockMvc.perform(get("/api/auth/oidc/{provider}/authorization", "kakao")
                        .param("clientType", "WEB")
                        .param("purpose", "WITHDRAWAL"))
                .andExpect(status().isOk())
                .andReturn();
        String state = objectMapper.readTree(authorization.getResponse().getContentAsString())
                .get("state").asString();
        Cookie binder = authorization.getResponse().getCookie("BIBBIDI_OIDC_BINDER");

        mockMvc.perform(post("/api/auth/delete-grants/{provider}/callback", "kakao")
                        .param("clientType", "WEB")
                        .header(AUTHORIZATION, "Bearer " + session.accessToken())
                        .cookie(binder)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new SocialLoginRequest("authorization-code", state))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.deleteGrant").isNotEmpty())
                .andDo(document(
                        "auth-delete-grant-issue",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Auth")
                                .summary("Issue a delete grant")
                                .description("Issues a delete grant after successful social reauthentication.")
                                .pathParameters(parameterWithName("provider").description("kakao or google"))
                                .queryParameters(parameterWithName("clientType").description("WEB or NATIVE"))
                                .requestSchema(schema("SocialLoginRequest"))
                                .requestHeaders(headerWithName(AUTHORIZATION)
                                        .description("濡쒓렇?명븳 ?뚯썝??access token"))
                                .requestFields(
                                        PayloadDocumentation.fieldWithPath("code")
                                                .description("Authorization code returned by the provider"),
                                        PayloadDocumentation.fieldWithPath("state")
                                                .description("State issued when authorization started"))
                                .responseSchema(schema("DeleteGrantResponse"))
                                .responseFields(PayloadDocumentation.fieldWithPath("deleteGrant")
                                        .description("Grant used to confirm withdrawal"))
                                .build())));
    }

    @Test
    @DisplayName("소셜 재인증으로 받은 표를 내면 탈퇴한다")
    void shouldWithdrawWithDeleteGrant() throws Exception {
        mockMvc.perform(delete("/api/users/me")
                        .header(AUTHORIZATION, "Bearer " + session.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new WithdrawalRequest(bibbidiTokenIssuer.issueDeleteGrantToken(userId)))))
                .andExpect(status().isNoContent())
                .andDo(document(
                        "users-withdraw",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Auth")
                                .summary("회원 탈퇴")
                                .description("access token만으로는 탈퇴시키지 않습니다. "
                                        + "소셜로 다시 인증해 받은 표를 함께 내야 합니다. "
                                        + "탈퇴하면 그 회원의 모든 세션을 끊습니다.")
                                .requestSchema(schema("WithdrawalRequest"))
                                .requestHeaders(headerWithName(AUTHORIZATION)
                                        .description("로그인한 회원의 access token"))
                                .requestFields(PayloadDocumentation.fieldWithPath("deleteGrant")
                                        .description("소셜 재인증으로 받은 탈퇴용 표"))
                                .build())));
    }

    @Test
    @DisplayName("탈퇴 표가 없으면 요청을 거절한다")
    void shouldRejectWithdrawalWithoutDeleteGrant() throws Exception {
        mockMvc.perform(delete("/api/users/me")
                        .header(AUTHORIZATION, "Bearer " + session.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new WithdrawalRequest(""))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("로그인하지 않으면 탈퇴할 수 없다")
    void shouldRequireAuthenticationToWithdraw() throws Exception {
        mockMvc.perform(delete("/api/users/me")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new WithdrawalRequest(bibbidiTokenIssuer.issueDeleteGrantToken(userId)))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201));
    }
}
