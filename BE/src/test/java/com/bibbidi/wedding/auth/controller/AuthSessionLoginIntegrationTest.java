package com.bibbidi.wedding.auth.controller;

import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.parameterWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.auth.controller.dto.request.SocialLoginRequest;
import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.auth.oidc.client.OidcTokenExchangeClient;
import com.bibbidi.wedding.auth.oidc.verification.IdTokenVerifier;
import com.bibbidi.wedding.auth.oidc.verification.VerifiedOidcUser;
import com.bibbidi.wedding.support.BibbidiIntegrationTest;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.restdocs.payload.PayloadDocumentation;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.ObjectMapper;

class AuthSessionLoginIntegrationTest extends BibbidiIntegrationTest {

    private static final String REFRESH_COOKIE = "BIBBIDI_REFRESH";
    private static final String BINDER_COOKIE = "BIBBIDI_OIDC_BINDER";

    private Cookie binderCookie;

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
        willAnswer(invocation -> new VerifiedOidcUser(
                invocation.getArgument(0), "social-user-1", "비비디", "user@bibbidi.kr"))
                .given(idTokenVerifier)
                .verify(any(SocialProvider.class), anyString(), anyString());
    }

    @Test
    @DisplayName("웹은 access token만 본문으로 받고 refresh token은 쿠키로 받는다")
    void shouldGiveRefreshTokenAsCookieOnWeb() throws Exception {
        SocialLoginRequest request = loginRequest("WEB");
        MvcResult result = mockMvc.perform(post("/api/auth/web/oidc/{provider}/callback", "kakao")
                        .cookie(binderCookies())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
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
    @DisplayName("구글도 카카오와 같은 OIDC 로그인 흐름을 사용한다")
    void shouldLoginWithGoogle() throws Exception {
        SocialLoginRequest request = loginRequest("google", "WEB");

        mockMvc.perform(post("/api/auth/web/oidc/{provider}/callback", "google")
                        .cookie(binderCookies())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.termsAgreementRequired").value(true));
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
                        .cookie(binderCookies())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/auth/web/oidc/{provider}/callback", "kakao")
                        .cookie(binderCookies())
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

    @Test
    @DisplayName("인가를 시작한 브라우저가 아니면 거절한다")
    void shouldRejectCallbackFromOtherBrowser() throws Exception {
        SocialLoginRequest request = loginRequest("WEB");

        mockMvc.perform(post("/api/auth/web/oidc/{provider}/callback", "kakao")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(208));
    }

    @Test
    @DisplayName("다른 사람이 받은 인가 결과를 제 브라우저 쿠키와 섞어 내면 거절한다")
    void shouldRejectMismatchedBrowserBinder() throws Exception {
        SocialLoginRequest attackerRequest = loginRequest("WEB");
        Cookie attackerCookie = binderCookie;
        loginRequest("WEB");
        Cookie victimCookie = binderCookie;

        assertThat(attackerCookie.getValue()).isNotEqualTo(victimCookie.getValue());

        mockMvc.perform(post("/api/auth/web/oidc/{provider}/callback", "kakao")
                        .cookie(victimCookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(attackerRequest)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(208));
    }

    @Test
    @DisplayName("네이티브는 쿠키를 쓰지 않으므로 브라우저 확인 없이 통과한다")
    void shouldNotRequireBinderOnNative() throws Exception {
        mockMvc.perform(post("/api/auth/native/oidc/{provider}/callback", "kakao")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest("NATIVE"))))
                .andExpect(status().isCreated());
    }

    private SocialLoginRequest loginRequest(String clientType) throws Exception {
        return loginRequest("kakao", clientType);
    }

    private SocialLoginRequest loginRequest(String provider, String clientType) throws Exception {
        return new SocialLoginRequest("authorization-code", startAuthorization(provider, clientType));
    }

    /**
     * 인가를 시작하고 state를 돌려준다. 웹이면 브라우저 바인딩 쿠키도 받아 둔다.
     */
    private String startAuthorization(String clientType) throws Exception {
        return startAuthorization("kakao", clientType);
    }

    private String startAuthorization(String provider, String clientType) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/auth/oidc/{provider}/authorization", provider)
                        .param("clientType", clientType))
                .andExpect(status().isOk())
                .andReturn();
        binderCookie = result.getResponse().getCookie(BINDER_COOKIE);
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("state").asString();
    }

    private Cookie[] binderCookies() {
        return binderCookie == null ? new Cookie[0] : new Cookie[]{binderCookie};
    }

    private String login(String clientType) throws Exception {
        SocialLoginRequest request = loginRequest(clientType);
        return mockMvc.perform(post("/api/auth/web/oidc/{provider}/callback", "kakao")
                        .cookie(binderCookies())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
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
