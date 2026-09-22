package com.bibbidi.wedding.auth.controller;

import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.headerWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.auth.controller.dto.WithdrawalRequest;
import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.service.session.IssuedSession;
import com.bibbidi.wedding.auth.service.session.SessionIssueService;
import com.bibbidi.wedding.auth.service.session.SessionOwner;
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

    private IssuedSession session;
    private Long userId;

    @BeforeEach
    void setUp() {
        UserResult created = userService.createPendingUser("current", "current@bibbidi.kr");
        UserResult active = userService.activate(created.id());
        userId = active.id();
        session = sessionIssueService.issueForNewFamily(
                new SessionOwner(active.id(), active.status(), active.role(), active.nickname(),
                        active.email()),
                ClientType.WEB);
    }

    @Test
    @DisplayName("소셜 재인증으로 받은 표를 내면 탈퇴한다")
    void shouldWithdrawWithDeleteGrant() throws Exception {
        mockMvc.perform(delete("/api/users/me")
                        .header(AUTHORIZATION, "Bearer " + session.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new WithdrawalRequest(bibbidiTokenIssuer.issueDeleteGrant(userId)))))
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
                                new WithdrawalRequest(bibbidiTokenIssuer.issueDeleteGrant(userId)))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201));
    }
}
