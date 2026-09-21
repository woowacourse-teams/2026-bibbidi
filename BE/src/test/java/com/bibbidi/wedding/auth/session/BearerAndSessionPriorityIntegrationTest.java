package com.bibbidi.wedding.auth.session;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.auth.token.AccessTokenProvider;
import com.bibbidi.wedding.support.BibbidiIntegrationTest;
import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.jdbc.Sql;

@Sql("/auth-login-fixture.sql")
class BearerAndSessionPriorityIntegrationTest extends BibbidiIntegrationTest {

    private static final Long USER_ID = 1L;
    private static final String NICKNAME = "bibbidi";
    private static final String CURRENT_USER_URI = "/api/users/me";

    @Autowired
    private AccessTokenProvider accessTokenProvider;

    @Test
    @DisplayName("Bearer Access Token으로 보호 API를 호출할 수 있다")
    void shouldAuthenticateWithBearerAccessToken() throws Exception {
        String accessToken = accessTokenProvider.issue(USER_ID, Instant.now());

        mockMvc.perform(get(CURRENT_USER_URI)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname").value(NICKNAME));
    }

    @Test
    @DisplayName("Authorization 헤더가 없으면 기존 JSESSIONID 세션으로 인증한다")
    void shouldFallBackToSessionWhenAuthorizationHeaderIsMissing() throws Exception {
        mockMvc.perform(get(CURRENT_USER_URI).session(authenticatedSession()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname").value(NICKNAME));
    }

    @Test
    @DisplayName("쓸 수 없는 Bearer 토큰이 오면 세션이 살아 있어도 세션으로 되돌아가지 않는다")
    void shouldNotFallBackToSessionWhenBearerTokenIsInvalid() throws Exception {
        mockMvc.perform(get(CURRENT_USER_URI)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer not-a-real-token")
                        .session(authenticatedSession()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(202));
    }

    @Test
    @DisplayName("Bearer 형식이 아닌 Authorization 헤더는 거절한다")
    void shouldRejectNonBearerAuthorizationHeader() throws Exception {
        mockMvc.perform(get(CURRENT_USER_URI)
                        .header(HttpHeaders.AUTHORIZATION, "Basic YmliYmlkaTp3aXNo")
                        .session(authenticatedSession()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(202));
    }

    @Test
    @DisplayName("빈 Authorization 헤더가 있으면 세션이 살아 있어도 거절한다")
    void shouldRejectBlankAuthorizationHeaderWithoutSessionFallback() throws Exception {
        mockMvc.perform(get(CURRENT_USER_URI)
                        .header(HttpHeaders.AUTHORIZATION, " ")
                        .session(authenticatedSession()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(202));
    }

    @Test
    @DisplayName("Bearer 토큰도 세션도 없으면 로그인이 필요하다고 알린다")
    void shouldRequireLoginWithoutBearerAndSession() throws Exception {
        mockMvc.perform(get(CURRENT_USER_URI))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201));
    }

    private MockHttpSession authenticatedSession() {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(AuthSession.USER_ID_ATTRIBUTE, USER_ID);
        return session;
    }
}
