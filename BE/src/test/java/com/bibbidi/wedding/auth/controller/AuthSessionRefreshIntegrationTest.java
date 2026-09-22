package com.bibbidi.wedding.auth.controller;

import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.headerWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.parameterWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.auth.controller.dto.request.NativeSessionRefreshRequest;
import com.bibbidi.wedding.auth.controller.dto.request.TermsAgreementRequest;
import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.service.dto.IssuedSession;
import com.bibbidi.wedding.auth.service.SessionIssueService;
import com.bibbidi.wedding.auth.service.dto.UserAuthInfo;
import com.bibbidi.wedding.support.BibbidiIntegrationTest;
import com.bibbidi.wedding.user.service.UserResult;
import com.bibbidi.wedding.user.service.UserService;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import jakarta.servlet.http.Cookie;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.restdocs.payload.PayloadDocumentation;
import org.springframework.test.context.jdbc.Sql;
import tools.jackson.databind.ObjectMapper;

/**
 * 로그인 상태를 이어 가거나 끊는 API를 확인하고 문서로 남긴다.
 */
@Sql("/terms-fixture.sql")
class AuthSessionRefreshIntegrationTest extends BibbidiIntegrationTest {

    private static final String REFRESH_COOKIE = "BIBBIDI_REFRESH";
    private static final Long REQUIRED_SERVICE_TERMS_ID = 1L;
    private static final Long REQUIRED_PRIVACY_TERMS_ID = 2L;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SessionIssueService sessionIssueService;

    @Autowired
    private UserService userService;

    private UserAuthInfo owner;

    @BeforeEach
    void setUp() {
        UserResult created = userService.createPendingUser("current", "current@bibbidi.kr");
        UserResult active = userService.activate(created.id());
        owner = new UserAuthInfo(
                active.id(), active.status(), active.role(), active.nickname(), active.email());
    }

    @Test
    @DisplayName("웹은 쿠키로 갱신하고 새 쿠키를 받는다")
    void shouldRefreshWebSessionWithCookie() throws Exception {
        IssuedSession issued = sessionIssueService.issueForNewFamily(owner, ClientType.WEB);

        String setCookie = mockMvc.perform(post("/api/auth/web/sessions/refresh")
                        .cookie(new Cookie(REFRESH_COOKIE, issued.refreshToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andDo(document(
                        "auth-web-session-refresh",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Auth")
                                .summary("웹 세션 갱신")
                                .description("refresh 쿠키로 새 한 쌍을 받습니다. 쓴 refresh token은 다시 쓸 수 없습니다.")
                                .responseSchema(schema("WebSessionResponse"))
                                .responseFields(
                                        PayloadDocumentation.fieldWithPath("accessToken")
                                                .description("새 access token"),
                                        PayloadDocumentation.fieldWithPath("termsAgreementRequired")
                                                .description("약관 동의가 필요한 상태인지"))
                                .build())))
                .andReturn()
                .getResponse()
                .getHeader("Set-Cookie");

        assertThat(setCookie).contains(REFRESH_COOKIE).contains("HttpOnly").contains("Secure");
    }

    @Test
    @DisplayName("네이티브는 본문으로 갱신하고 본문으로 받는다")
    void shouldRefreshNativeSessionWithBody() throws Exception {
        IssuedSession issued = sessionIssueService.issueForNewFamily(owner, ClientType.NATIVE);

        mockMvc.perform(post("/api/auth/native/sessions/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new NativeSessionRefreshRequest(issued.refreshToken()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                .andDo(document(
                        "auth-native-session-refresh",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Auth")
                                .summary("네이티브 세션 갱신")
                                .description("앱은 쿠키를 쓰지 않으므로 refresh token을 본문으로 주고받습니다.")
                                .requestSchema(schema("NativeSessionRefreshRequest"))
                                .responseSchema(schema("NativeSessionResponse"))
                                .requestFields(PayloadDocumentation.fieldWithPath("refreshToken")
                                        .description("지금 가지고 있는 refresh token"))
                                .responseFields(
                                        PayloadDocumentation.fieldWithPath("accessToken")
                                                .description("새 access token"),
                                        PayloadDocumentation.fieldWithPath("refreshToken")
                                                .description("새 refresh token"),
                                        PayloadDocumentation.fieldWithPath("termsAgreementRequired")
                                                .description("약관 동의가 필요한 상태인지"))
                                .build())));
    }

    @Test
    @DisplayName("native logout revokes the session")
    void shouldRevokeNativeSessionOnLogOut() throws Exception {
        IssuedSession issued = sessionIssueService.issueForNewFamily(owner, ClientType.NATIVE);

        mockMvc.perform(delete("/api/auth/native/sessions/current")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new NativeSessionRefreshRequest(issued.refreshToken()))))
                .andExpect(status().isNoContent())
                .andDo(document(
                        "auth-native-session-logout",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Auth")
                                .summary("Native session logout")
                                .description("Revokes the session using the refresh token in the request body.")
                                .requestSchema(schema("NativeSessionRefreshRequest"))
                                .requestFields(PayloadDocumentation.fieldWithPath("refreshToken")
                                        .description("Refresh token to revoke"))
                                .build())))
                .andReturn();

        mockMvc.perform(post("/api/auth/native/sessions/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new NativeSessionRefreshRequest(issued.refreshToken()))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(206));
    }

    @Test
    @DisplayName("웹 로그아웃은 쿠키를 만료시킨다")
    void shouldExpireCookieOnWebLogOut() throws Exception {
        IssuedSession issued = sessionIssueService.issueForNewFamily(owner, ClientType.WEB);

        String setCookie = mockMvc.perform(delete("/api/auth/web/sessions/current")
                        .cookie(new Cookie(REFRESH_COOKIE, issued.refreshToken())))
                .andExpect(status().isNoContent())
                .andDo(document(
                        "auth-web-session-logout",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Auth")
                                .summary("웹 로그아웃")
                                .description("그 기기 계열의 세션만 끊고 refresh 쿠키를 만료시킵니다.")
                                .build())))
                .andReturn()
                .getResponse()
                .getHeader("Set-Cookie");

        assertThat(setCookie).contains(REFRESH_COOKIE).contains("Max-Age=0");
    }

    @Test
    @DisplayName("refresh 쿠키가 없으면 갱신할 수 없다")
    void shouldRejectWebRefreshWithoutCookie() throws Exception {
        mockMvc.perform(post("/api/auth/web/sessions/refresh"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(206));
    }

    @Test
    @DisplayName("약관에 동의하기 전에는 다른 API를 부를 수 없고, 동의하면 새 token으로 통과한다")
    void shouldBlockPendingUserUntilTermsAgreed() throws Exception {
        UserResult pending = userService.createPendingUser("pending", null);
        UserAuthInfo pendingOwner = new UserAuthInfo(
                pending.id(), pending.status(), pending.role(), pending.nickname(), pending.email());
        IssuedSession issued = sessionIssueService.issueForNewFamily(pendingOwner, ClientType.WEB);

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/users/me")
                        .header(AUTHORIZATION, "Bearer " + issued.accessToken()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value(211));

        String reissued = mockMvc.perform(post("/api/users/me/terms-agreement")
                        .header(AUTHORIZATION, "Bearer " + issued.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new TermsAgreementRequest(
                                List.of(REQUIRED_SERVICE_TERMS_ID, REQUIRED_PRIVACY_TERMS_ID)))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andDo(document(
                        "auth-terms-agreement",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Auth")
                                .summary("약관 동의로 가입 완료")
                                .description("필수 약관에 모두 동의하면 서비스를 쓸 수 있는 상태가 되고 "
                                        + "그 자리에서 access token을 새로 내줍니다.")
                                .requestSchema(schema("TermsAgreementRequest"))
                                .responseSchema(schema("TermsAgreementResponse"))
                                .requestHeaders(headerWithName(AUTHORIZATION)
                                        .description("가입이 끝나지 않은 회원의 access token"))
                                .requestFields(PayloadDocumentation.fieldWithPath("agreedTermsIds")
                                        .description("동의한 약관 식별자 목록"))
                                .responseFields(PayloadDocumentation.fieldWithPath("accessToken")
                                        .description("가입이 끝난 상태가 담긴 새 access token"))
                                .build())))
                .andReturn()
                .getResponse()
                .getContentAsString();

        String newAccessToken = objectMapper.readTree(reissued).get("accessToken").asString();
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/users/me")
                        .header(AUTHORIZATION, "Bearer " + newAccessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname").value("pending"));
    }
}
