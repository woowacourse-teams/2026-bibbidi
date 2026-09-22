package com.bibbidi.wedding.auth.controller;

import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.headerWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.auth.controller.dto.HandoffCodeExchangeRequest;
import com.bibbidi.wedding.auth.controller.dto.NativeSessionRefreshRequest;
import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.service.session.IssuedSession;
import com.bibbidi.wedding.auth.service.session.SessionIssueService;
import com.bibbidi.wedding.auth.service.session.SessionOwner;
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
import tools.jackson.databind.ObjectMapper;

/** 네이티브 로그인을 앱 안 WebView로 넘기는 흐름을 확인하고 문서로 남긴다. */
class HandoffControllerIntegrationTest extends BibbidiIntegrationTest {

    private static final String REFRESH_COOKIE = "BIBBIDI_REFRESH";

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SessionIssueService sessionIssueService;

    @Autowired
    private UserService userService;

    private IssuedSession nativeSession;

    @BeforeEach
    void setUp() {
        UserResult created = userService.createPendingUser("current", "current@bibbidi.kr");
        UserResult active = userService.activate(created.id());
        SessionOwner owner = new SessionOwner(
                active.id(), active.status(), active.role(), active.nickname(), active.email());
        nativeSession = sessionIssueService.issueForNewFamily(owner, ClientType.NATIVE);
    }

    @Test
    @DisplayName("앱이 코드를 받아 WebView가 웹 세션 쿠키로 바꾼다")
    void shouldHandOffNativeLoginToWebView() throws Exception {
        String code = issueCode();

        String setCookie = mockMvc.perform(post("/api/auth/web/handoff-codes/exchange")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new HandoffCodeExchangeRequest(code))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andDo(document(
                        "auth-handoff-code-exchange",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Auth")
                                .summary("handoff code 교환")
                                .description("앱이 넘겨 준 1회용 코드를 내면 웹 세션 쿠키를 받습니다. "
                                        + "이 세션은 앱 세션과 같은 기기 계열에 들어갑니다.")
                                .requestSchema(schema("HandoffCodeExchangeRequest"))
                                .responseSchema(schema("WebSessionResponse"))
                                .requestFields(PayloadDocumentation.fieldWithPath("code")
                                        .description("앱이 발급받아 WebView에 넘긴 1회용 코드"))
                                .responseFields(
                                        PayloadDocumentation.fieldWithPath("accessToken")
                                                .description("WebView가 쓸 access token"),
                                        PayloadDocumentation.fieldWithPath("termsAgreementRequired")
                                                .description("약관 동의가 필요한 상태인지"))
                                .build())))
                .andReturn()
                .getResponse()
                .getHeader("Set-Cookie");

        assertThat(setCookie).contains(REFRESH_COOKIE).contains("HttpOnly");
    }

    @Test
    @DisplayName("한 번 쓴 코드는 다시 통하지 않는다")
    void shouldRejectReusedHandoffCode() throws Exception {
        String code = issueCode();
        exchange(code).andExpect(status().isCreated());

        exchange(code)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(209));
    }

    @Test
    @DisplayName("로그인하지 않으면 코드를 받을 수 없다")
    void shouldRequireAuthenticationToIssueCode() throws Exception {
        mockMvc.perform(post("/api/auth/native/handoff-codes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new NativeSessionRefreshRequest(nativeSession.refreshToken()))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201));
    }

    private String issueCode() throws Exception {
        String response = mockMvc.perform(post("/api/auth/native/handoff-codes")
                        .header(AUTHORIZATION, "Bearer " + nativeSession.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new NativeSessionRefreshRequest(nativeSession.refreshToken()))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").isNotEmpty())
                .andDo(document(
                        "auth-handoff-code-issue",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Auth")
                                .summary("handoff code 발급")
                                .description("앱이 자기 refresh token을 내면 WebView에 넘길 1회용 코드를 받습니다. "
                                        + "refresh token 원문은 앱 밖으로 나가지 않습니다.")
                                .requestSchema(schema("NativeSessionRefreshRequest"))
                                .responseSchema(schema("HandoffCodeResponse"))
                                .requestHeaders(headerWithName(AUTHORIZATION)
                                        .description("앱이 가진 access token"))
                                .requestFields(PayloadDocumentation.fieldWithPath("refreshToken")
                                        .description("앱이 가진 refresh token"))
                                .responseFields(PayloadDocumentation.fieldWithPath("code")
                                        .description("WebView 주소에 실어 넘기는 1회용 코드"))
                                .build())))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).get("code").asString();
    }

    private org.springframework.test.web.servlet.ResultActions exchange(String code) throws Exception {
        return mockMvc.perform(post("/api/auth/web/handoff-codes/exchange")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new HandoffCodeExchangeRequest(code))));
    }
}
