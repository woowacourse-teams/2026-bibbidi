package com.bibbidi.wedding.auth.controller;

import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.headerWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.restdocs.operation.preprocess.Preprocessors.modifyHeaders;
import static org.springframework.restdocs.operation.preprocess.Preprocessors.preprocessResponse;
import static org.springframework.restdocs.payload.PayloadDocumentation.fieldWithPath;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.auth.controller.dto.IssueTokenRequest;
import com.bibbidi.wedding.support.BibbidiIntegrationTest;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.ObjectMapper;

@Sql("/auth-login-fixture.sql")
class TokenControllerIntegrationTest extends BibbidiIntegrationTest {

    private static final String NICKNAME = "bibbidi";
    private static final String PASSWORD = "wish";
    private static final String REFRESH_COOKIE_NAME = "BIBBIDI_REFRESH";
    private static final String ALLOWED_ORIGIN = "https://test.bibbidi.kr";
    private static final String ANOTHER_ALLOWED_ORIGIN = "https://www.test.bibbidi.kr";
    private static final String DOCUMENTED_REFRESH_COOKIE =
            "BIBBIDI_REFRESH=<refresh-token>; Path=/api/auth/tokens; Max-Age=2592000; "
                    + "Secure; HttpOnly; SameSite=Lax";
    private static final String ISSUE_DESCRIPTION =
            "닉네임과 비밀번호를 검증하고 비비디 Access Token과 Refresh Token을 발급합니다. "
                    + "Access Token은 응답 본문으로, Refresh Token은 HttpOnly Cookie로 전달합니다.";
    private static final String REISSUE_DESCRIPTION =
            "Refresh Cookie로 Access Token을 다시 발급합니다. "
                    + "성공하면 Refresh Token도 새로 발급하고 이전 Refresh Token은 즉시 무효가 됩니다.";

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("올바른 인증 정보로 요청하면 Access Token을 본문으로, Refresh Token을 쿠키로 발급한다")
    void shouldIssueAccessTokenInBodyAndRefreshTokenInCookie() throws Exception {
        MvcResult result = mockMvc.perform(issueRequest(PASSWORD))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andDo(document(
                        "auth-token-issue",
                        preprocessResponse(modifyHeaders().set(
                                HttpHeaders.SET_COOKIE, DOCUMENTED_REFRESH_COOKIE)),
                        resource(ResourceSnippetParameters.builder()
                                .tag("Authentication")
                                .summary("토큰 발급")
                                .description(ISSUE_DESCRIPTION)
                                .requestSchema(schema("IssueTokenRequest"))
                                .responseSchema(schema("AccessTokenResponse"))
                                .requestFields(
                                        fieldWithPath("nickname").description("가입한 사용자 닉네임"),
                                        fieldWithPath("password").description("가입 시 설정한 사용자 비밀번호")
                                )
                                .responseFields(
                                        fieldWithPath("accessToken").description("30분 동안 쓸 수 있는 Access Token")
                                )
                                .responseHeaders(
                                        headerWithName(HttpHeaders.SET_COOKIE)
                                                .description("재발급에 쓸 Refresh Token Cookie "
                                                        + "(Path=/api/auth/tokens; Secure; HttpOnly; SameSite=Lax)")
                                )
                                .build())
                ))
                .andReturn();

        String setCookie = setCookieHeader(result.getResponse());
        assertThat(setCookie)
                .contains(REFRESH_COOKIE_NAME + "=")
                .contains("Path=/api/auth/tokens")
                .contains("Secure")
                .contains("HttpOnly")
                .contains("SameSite=Lax")
                .doesNotContain("Domain=");
        assertThat(result.getResponse().getContentAsString()).doesNotContain(PASSWORD);
    }

    @Test
    @DisplayName("비밀번호가 틀리면 토큰을 발급하지 않는다")
    void shouldNotIssueTokenWhenPasswordIsWrong() throws Exception {
        mockMvc.perform(issueRequest("wrong-password"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(202))
                .andExpect(jsonPath("$.accessToken").doesNotExist());
    }

    @Test
    @DisplayName("Refresh Cookie로 재발급하면 새 Access Token과 새 Refresh Token을 준다")
    void shouldReissueTokensWithRefreshCookie() throws Exception {
        Cookie refreshCookie = issuedRefreshCookie();

        MvcResult result = mockMvc.perform(post("/api/auth/tokens/reissue")
                        .header(HttpHeaders.ORIGIN, ALLOWED_ORIGIN)
                        .cookie(refreshCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andDo(document(
                        "auth-token-reissue",
                        preprocessResponse(modifyHeaders().set(
                                HttpHeaders.SET_COOKIE, DOCUMENTED_REFRESH_COOKIE)),
                        resource(ResourceSnippetParameters.builder()
                                .tag("Authentication")
                                .summary("토큰 재발급")
                                .description(REISSUE_DESCRIPTION)
                                .responseSchema(schema("AccessTokenResponse"))
                                .requestHeaders(
                                        headerWithName(HttpHeaders.ORIGIN)
                                                .description("허용된 클라이언트 출처")
                                )
                                .responseFields(
                                        fieldWithPath("accessToken").description("새로 발급한 Access Token")
                                )
                                .responseHeaders(
                                        headerWithName(HttpHeaders.SET_COOKIE)
                                                .description("새로 발급한 Refresh Token Cookie")
                                )
                                .build())
                ))
                .andReturn();

        String reissuedCookie = setCookieHeader(result.getResponse());
        assertThat(reissuedCookie).doesNotContain(refreshCookie.getValue());
    }

    @Test
    @DisplayName("한 번 재발급에 쓴 Refresh Token은 다시 쓸 수 없다")
    void shouldRejectAlreadyRotatedRefreshToken() throws Exception {
        Cookie refreshCookie = issuedRefreshCookie();

        mockMvc.perform(post("/api/auth/tokens/reissue")
                        .header(HttpHeaders.ORIGIN, ALLOWED_ORIGIN)
                        .cookie(refreshCookie))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/tokens/reissue")
                        .header(HttpHeaders.ORIGIN, ALLOWED_ORIGIN)
                        .cookie(refreshCookie))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(202));
    }

    @Test
    @DisplayName("Refresh Cookie 없이 재발급하면 로그인이 필요하다고 알린다")
    void shouldRequireRefreshCookieForReissue() throws Exception {
        mockMvc.perform(post("/api/auth/tokens/reissue")
                        .header(HttpHeaders.ORIGIN, ALLOWED_ORIGIN))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201));
    }

    @Test
    @DisplayName("쉼표로 이어 적은 허용 출처를 모두 받아들인다")
    void shouldAcceptEveryConfiguredOrigin() throws Exception {
        mockMvc.perform(post("/api/auth/tokens/reissue")
                        .header(HttpHeaders.ORIGIN, ANOTHER_ALLOWED_ORIGIN)
                        .cookie(issuedRefreshCookie()))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("허용하지 않은 출처에서 온 재발급 요청은 거절한다")
    void shouldRejectReissueFromDisallowedOrigin() throws Exception {
        Cookie refreshCookie = issuedRefreshCookie();

        mockMvc.perform(post("/api/auth/tokens/reissue")
                        .header(HttpHeaders.ORIGIN, "https://evil.example.com")
                        .cookie(refreshCookie))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(202));
    }

    @Test
    @DisplayName("Origin이 없는 재발급 요청은 거절한다")
    void shouldRejectReissueWithoutOrigin() throws Exception {
        mockMvc.perform(post("/api/auth/tokens/reissue")
                        .cookie(issuedRefreshCookie()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(202));
    }

    @Test
    @DisplayName("로그아웃하면 해당 Refresh 세션을 폐기하고 쿠키를 지운다")
    void shouldDiscardCurrentRefreshSessionOnLogout() throws Exception {
        Cookie refreshCookie = issuedRefreshCookie();

        MvcResult result = mockMvc.perform(delete("/api/auth/tokens/current")
                        .header(HttpHeaders.ORIGIN, ALLOWED_ORIGIN)
                        .cookie(refreshCookie))
                .andExpect(status().isNoContent())
                .andDo(document(
                        "auth-token-logout",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Authentication")
                                .summary("로그아웃")
                                .description("요청에 실린 Refresh 세션만 폐기하고 Refresh Cookie를 지웁니다. "
                                        + "같은 사용자의 다른 기기 세션은 그대로 남습니다.")
                                .requestHeaders(
                                        headerWithName(HttpHeaders.ORIGIN)
                                                .description("허용된 클라이언트 출처")
                                )
                                .responseHeaders(
                                        headerWithName(HttpHeaders.SET_COOKIE)
                                                .description("Max-Age=0으로 지워지는 Refresh Token Cookie")
                                )
                                .build())
                ))
                .andReturn();

        assertThat(setCookieHeader(result.getResponse())).contains("Max-Age=0");

        mockMvc.perform(post("/api/auth/tokens/reissue")
                        .header(HttpHeaders.ORIGIN, ALLOWED_ORIGIN)
                        .cookie(refreshCookie))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(202));
    }

    @Test
    @DisplayName("Refresh Cookie가 없어도 로그아웃은 성공으로 끝난다")
    void shouldFinishLogoutWithoutRefreshCookie() throws Exception {
        mockMvc.perform(delete("/api/auth/tokens/current")
                        .header(HttpHeaders.ORIGIN, ALLOWED_ORIGIN))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("Origin이 없는 로그아웃 요청은 거절한다")
    void shouldRejectLogoutWithoutOrigin() throws Exception {
        mockMvc.perform(delete("/api/auth/tokens/current"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(202));
    }

    @Test
    @DisplayName("한 기기에서 로그아웃해도 다른 기기의 Refresh 세션은 살아 있다")
    void shouldKeepOtherDeviceSessionAliveAfterLogout() throws Exception {
        Cookie phoneCookie = issuedRefreshCookie();
        Cookie laptopCookie = issuedRefreshCookie();

        mockMvc.perform(delete("/api/auth/tokens/current")
                        .header(HttpHeaders.ORIGIN, ALLOWED_ORIGIN)
                        .cookie(phoneCookie))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/auth/tokens/reissue")
                        .header(HttpHeaders.ORIGIN, ALLOWED_ORIGIN)
                        .cookie(laptopCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty());
    }

    private Cookie issuedRefreshCookie() throws Exception {
        MvcResult result = mockMvc.perform(issueRequest(PASSWORD))
                .andExpect(status().isCreated())
                .andReturn();

        String setCookie = setCookieHeader(result.getResponse());
        String value = setCookie.substring(
                setCookie.indexOf('=') + 1,
                setCookie.indexOf(';'));
        return new Cookie(REFRESH_COOKIE_NAME, value);
    }

    private String setCookieHeader(MockHttpServletResponse response) {
        String setCookie = response.getHeader(HttpHeaders.SET_COOKIE);
        assertThat(setCookie).isNotNull();
        return setCookie;
    }

    private MockHttpServletRequestBuilder issueRequest(String password) throws Exception {
        return post("/api/auth/tokens")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new IssueTokenRequest(NICKNAME, password)));
    }
}
