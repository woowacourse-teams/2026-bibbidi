package com.bibbidi.wedding.auth.controller;

import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.parameterWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.auth.controller.dto.SocialLoginRequest;
import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.auth.oidc.client.OidcTokenExchangeClient;
import com.bibbidi.wedding.auth.oidc.idtoken.IdTokenVerifier;
import com.bibbidi.wedding.auth.oidc.idtoken.SocialUserIdentity;
import com.bibbidi.wedding.support.BibbidiIntegrationTest;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.restdocs.payload.PayloadDocumentation;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.ObjectMapper;

/**
 * 카카오와 구글을 실제로 부르지 않는다.
 * 어댑터 경계에서 대역을 세우고, 서버가 웹과 네이티브에 어떤 형태로 내려 주는지를 확인한다.
 */
class SocialLoginControllerIntegrationTest extends BibbidiIntegrationTest {

    private static final String REFRESH_COOKIE = "BIBBIDI_REFRESH";

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private OidcTokenExchangeClient oidcTokenExchangeClient;

    @MockitoBean
    private IdTokenVerifier idTokenVerifier;

    @BeforeEach
    void stubProvider() {
        given(oidcTokenExchangeClient.exchangeForIdToken(any(), anyString(), anyString(), anyString()))
                .willReturn("id-token");
        given(idTokenVerifier.verify(any(SocialProvider.class), anyString(), anyString()))
                .willReturn(new SocialUserIdentity(
                        SocialProvider.KAKAO, "social-user-1", "비비디", "user@bibbidi.kr"));
    }

    @Test
    @DisplayName("웹은 access token만 본문으로 받고 refresh token은 쿠키로 받는다")
    void shouldGiveRefreshTokenAsCookieOnWeb() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/web/oidc/{provider}/callback", "kakao")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest("WEB"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andExpect(jsonPath("$.termsAgreementRequired").value(true))
                .andDo(document(
                        "auth-web-oidc-callback",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Auth")
                                .summary("웹 소셜 로그인 완료")
                                .description("인가 코드를 서버가 토큰으로 바꾸고 id_token을 검증한 뒤 세션을 발급합니다. "
                                        + "refresh token은 Secure·HttpOnly 쿠키로 내려갑니다.")
                                .requestSchema(schema("SocialLoginRequest"))
                                .responseSchema(schema("WebSessionResponse"))
                                .pathParameters(parameterWithName("provider").description("kakao 또는 google"))
                                .requestFields(
                                        PayloadDocumentation.fieldWithPath("code")
                                                .description("제공자가 돌려준 인가 코드"),
                                        PayloadDocumentation.fieldWithPath("state")
                                                .description("인가를 시작할 때 서버가 준 값"))
                                .responseFields(
                                        PayloadDocumentation.fieldWithPath("accessToken")
                                                .description("API 호출에 싣는 access token"),
                                        PayloadDocumentation.fieldWithPath("termsAgreementRequired")
                                                .description("약관에 동의해야 서비스를 쓸 수 있는 상태인지"))
                                .build())))
                .andReturn();

        String setCookie = result.getResponse().getHeader("Set-Cookie");
        assertThat(setCookie)
                .contains(REFRESH_COOKIE)
                .contains("HttpOnly")
                .contains("Secure")
                .contains("SameSite=Lax")
                .contains("Path=/api/auth");
    }

    @Test
    @DisplayName("네이티브는 두 token을 모두 본문으로 받고 쿠키는 받지 않는다")
    void shouldGiveBothTokensInBodyOnNative() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/native/oidc/{provider}/callback", "kakao")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest("NATIVE"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                .andDo(document(
                        "auth-native-oidc-callback",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Auth")
                                .summary("네이티브 소셜 로그인 완료")
                                .description("쿠키를 쓰지 않는 앱을 위해 refresh token까지 응답 본문으로 내려 줍니다.")
                                .requestSchema(schema("SocialLoginRequest"))
                                .responseSchema(schema("NativeSessionResponse"))
                                .pathParameters(parameterWithName("provider").description("kakao 또는 google"))
                                .requestFields(
                                        PayloadDocumentation.fieldWithPath("code")
                                                .description("제공자가 돌려준 인가 코드"),
                                        PayloadDocumentation.fieldWithPath("state")
                                                .description("인가를 시작할 때 서버가 준 값"))
                                .responseFields(
                                        PayloadDocumentation.fieldWithPath("accessToken")
                                                .description("API 호출에 싣는 access token"),
                                        PayloadDocumentation.fieldWithPath("refreshToken")
                                                .description("access token이 만료되면 새로 받을 때 쓰는 값"),
                                        PayloadDocumentation.fieldWithPath("termsAgreementRequired")
                                                .description("약관에 동의해야 서비스를 쓸 수 있는 상태인지"))
                                .build())))
                .andReturn();

        assertThat(result.getResponse().getHeader("Set-Cookie")).isNull();
    }

    @Test
    @DisplayName("같은 소셜 계정으로 다시 로그인하면 회원을 새로 만들지 않는다")
    void shouldReuseUserOnSecondLogin() throws Exception {
        String first = login("WEB");
        String second = login("WEB");

        assertThat(userIdOf(first)).isEqualTo(userIdOf(second));
    }

    @Test
    @DisplayName("서버가 만든 적 없는 state로는 로그인할 수 없다")
    void shouldRejectUnknownState() throws Exception {
        mockMvc.perform(post("/api/auth/web/oidc/{provider}/callback", "kakao")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new SocialLoginRequest("code", "state-we-never-made"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(208));
    }

    @Test
    @DisplayName("한 번 쓴 state는 다시 쓸 수 없다")
    void shouldRejectReusedState() throws Exception {
        String state = startAuthorization("WEB");
        String body = objectMapper.writeValueAsString(new SocialLoginRequest("code", state));

        mockMvc.perform(post("/api/auth/web/oidc/{provider}/callback", "kakao")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/auth/web/oidc/{provider}/callback", "kakao")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(208));
    }

    @Test
    @DisplayName("인가를 시작할 때와 다른 클라이언트 종류로 돌아오면 거절한다")
    void shouldRejectCallbackFromOtherClientType() throws Exception {
        String state = startAuthorization("WEB");

        mockMvc.perform(post("/api/auth/native/oidc/{provider}/callback", "kakao")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new SocialLoginRequest("code", state))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(208));
    }

    @Test
    @DisplayName("지원하지 않는 제공자는 거절한다")
    void shouldRejectUnsupportedProvider() throws Exception {
        mockMvc.perform(get("/api/auth/oidc/{provider}/authorization", "naver")
                        .param("clientType", "WEB"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(103));
    }

    @Test
    @DisplayName("인가 주소에는 우리가 만든 state와 nonce, PKCE 값이 실린다")
    void shouldIncludeStateNonceAndCodeChallenge() throws Exception {
        mockMvc.perform(get("/api/auth/oidc/{provider}/authorization", "kakao")
                        .param("clientType", "WEB"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state").isNotEmpty())
                .andExpect(jsonPath("$.authorizationUri").value(
                        org.hamcrest.Matchers.allOf(
                                org.hamcrest.Matchers.containsString("state="),
                                org.hamcrest.Matchers.containsString("nonce="),
                                org.hamcrest.Matchers.containsString("code_challenge="),
                                org.hamcrest.Matchers.containsString("code_challenge_method=S256"))))
                .andDo(document(
                        "auth-oidc-authorization",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Auth")
                                .summary("소셜 인가 시작")
                                .description("서버가 state와 nonce, PKCE 값을 만들어 저장하고 인가 화면 주소를 돌려줍니다.")
                                .responseSchema(schema("SocialAuthorizationResponse"))
                                .pathParameters(parameterWithName("provider").description("kakao 또는 google"))
                                .queryParameters(
                                        parameterWithName("clientType").description("WEB 또는 NATIVE"),
                                        parameterWithName("purpose").optional()
                                                .description("LOGIN 또는 WITHDRAWAL. 비우면 LOGIN"))
                                .responseFields(
                                        PayloadDocumentation.fieldWithPath("authorizationUri")
                                                .description("사용자를 보낼 인가 화면 주소"),
                                        PayloadDocumentation.fieldWithPath("state")
                                                .description("돌아올 때 그대로 보내는 값"))
                                .build())));
    }

    private SocialLoginRequest loginRequest(String clientType) throws Exception {
        return new SocialLoginRequest("authorization-code", startAuthorization(clientType));
    }

    private String startAuthorization(String clientType) throws Exception {
        String response = mockMvc.perform(get("/api/auth/oidc/{provider}/authorization", "kakao")
                        .param("clientType", clientType))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).get("state").asString();
    }

    private String login(String clientType) throws Exception {
        return mockMvc.perform(post("/api/auth/web/oidc/{provider}/callback", "kakao")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest(clientType))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
    }

    private String userIdOf(String loginResponse) {
        String accessToken = objectMapper.readTree(loginResponse).get("accessToken").asString();
        String payload = new String(java.util.Base64.getUrlDecoder()
                .decode(accessToken.split("\\.")[1]));
        return objectMapper.readTree(payload).get("sub").asString();
    }
}
