package com.bibbidi.wedding.auth.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
@Import(AuthBoundaryIntegrationTest.AuthBoundaryTestConfiguration.class)
class AuthBoundaryIntegrationTest {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private OwnedResourceTestService ownedResourceTestService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
        ownedResourceTestService.reset();
    }

    @Test
    @DisplayName("Session이 없는 보호 API 요청은 인증 필요 오류로 실패한다")
    void shouldRejectProtectedApiWithoutSession() throws Exception {
        mockMvc.perform(get("/api/auth-boundary/owned-resources"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201))
                .andExpect(jsonPath("$.message").value("로그인이 필요합니다."))
                .andExpect(jsonPath("$.status").doesNotExist())
                .andExpect(result -> assertThat(result.getRequest().getSession(false)).isNull());

        assertThat(ownedResourceTestService.lastOwnerId()).isNull();
    }

    @Test
    @DisplayName("Session의 인증 정보가 유효하지 않으면 보호 API 요청을 거절한다")
    void shouldRejectProtectedApiWithInvalidSessionUserId() throws Exception {
        MockHttpSession session = authenticatedSession("7");

        mockMvc.perform(get("/api/auth-boundary/owned-resources").session(session))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201))
                .andExpect(jsonPath("$.message").value("로그인이 필요합니다."))
                .andExpect(jsonPath("$.status").doesNotExist());

        assertThat(ownedResourceTestService.lastOwnerId()).isNull();
    }

    @Test
    @DisplayName("보호 API는 요청 사용자 ID 대신 Session의 현재 사용자 ID로 소유 리소스를 조회한다")
    void shouldUseSessionUserIdInsteadOfRequestUserIdForOwnedResource() throws Exception {
        MockHttpSession session = authenticatedSession(7L);

        mockMvc.perform(get("/api/auth-boundary/owned-resources")
                        .param("userId", "999")
                        .session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ownerId").value(7));

        assertThat(ownedResourceTestService.lastOwnerId()).isEqualTo(7L);
    }

    @Test
    @DisplayName("Auth가 필요하지 않은 API는 Session 없이 접근할 수 있다")
    void shouldAllowApiWithoutAuthAndSession() throws Exception {
        mockMvc.perform(get("/api/auth-boundary/without-auth"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.loginRequired").value(false))
                .andExpect(result -> assertThat(result.getRequest().getSession(false)).isNull());
    }

    private MockHttpSession authenticatedSession(Object userId) {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(AuthSession.USER_ID_ATTRIBUTE, userId);
        return session;
    }

    @TestConfiguration
    static class AuthBoundaryTestConfiguration {

        @Bean
        AuthBoundaryTestController authBoundaryTestController(OwnedResourceTestService service) {
            return new AuthBoundaryTestController(service);
        }

        @Bean
        OwnedResourceTestService ownedResourceTestService() {
            return new OwnedResourceTestService();
        }
    }

    @RestController
    static class AuthBoundaryTestController {

        private final OwnedResourceTestService ownedResourceTestService;

        AuthBoundaryTestController(OwnedResourceTestService ownedResourceTestService) {
            this.ownedResourceTestService = ownedResourceTestService;
        }

        @GetMapping("/api/auth-boundary/owned-resources")
        OwnedResourceResponse findOwnedResources(@Auth Long currentUserId) {
            return new OwnedResourceResponse(ownedResourceTestService.findByOwnerId(currentUserId));
        }

        @GetMapping("/api/auth-boundary/without-auth")
        AuthRequirementResponse withoutAuth() {
            return new AuthRequirementResponse(false);
        }
    }

    static class OwnedResourceTestService {

        private Long lastOwnerId;

        Long findByOwnerId(Long ownerId) {
            lastOwnerId = ownerId;
            return ownerId;
        }

        Long lastOwnerId() {
            return lastOwnerId;
        }

        void reset() {
            lastOwnerId = null;
        }
    }

    record OwnedResourceResponse(Long ownerId) {
    }

    record AuthRequirementResponse(boolean loginRequired) {
    }
}
