package com.bibbidi.wedding.user.controller;

import static com.bibbidi.wedding.support.AuthenticationTestSupport.DOCUMENTED_AUTHORIZATION_HEADER;
import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.headerWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.restdocs.payload.PayloadDocumentation.fieldWithPath;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.auth.token.BibbidiTokenIssuer;
import com.bibbidi.wedding.support.AuthenticationTestSupport;
import com.bibbidi.wedding.support.BibbidiIntegrationTest;
import com.bibbidi.wedding.user.controller.dto.ChangeNicknameRequest;
import com.bibbidi.wedding.user.controller.dto.WeddingDateRequest;
import com.bibbidi.wedding.user.service.UserResult;
import com.bibbidi.wedding.user.service.UserService;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

class UserControllerIntegrationTest extends BibbidiIntegrationTest {

    private static final String CURRENT_USER_DESCRIPTION =
            "access token이 가리키는 사용자의 계정 정보를 조회합니다. "
                    + "token이 없으면 인증 필요 오류를, DB에 사용자가 없으면 사용자 없음 오류를 반환합니다.";
    private static final String CHANGE_NICKNAME_DESCRIPTION =
            "access token이 가리키는 사용자의 닉네임을 변경합니다. 사용자 ID는 바뀌지 않습니다.";
    private static final String WEDDING_DATE_DESCRIPTION =
            "access token이 가리키는 사용자의 결혼 예정일을 저장하거나 변경합니다. 과거 날짜와 동일한 날짜도 허용합니다.";
    private static final LocalDate WEDDING_DATE = LocalDate.of(
            2027,
            5,
            15);
    private static final LocalDate PAST_WEDDING_DATE = LocalDate.of(
            2020,
            1,
            1);

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserService userService;

    @Autowired
    private BibbidiTokenIssuer bibbidiTokenIssuer;

    private Long currentUserId;
    private Long otherUserId;

    @BeforeEach
    void setUp() {
        currentUserId = createActiveUser("current");
        otherUserId = createActiveUser("other");
    }

    @Test
    @DisplayName("access token이 가리키는 사용자의 정보를 조회하여 반환한다")
    void shouldFindCurrentUserFromAccessToken() throws Exception {
        mockMvc.perform(get("/api/users/me")
                        .header(AUTHORIZATION, bearerTokenOf(currentUserId, "current")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(currentUserId))
                .andExpect(jsonPath("$.nickname").value("current"))
                .andDo(document(
                        "users-find-current",
                        resource(ResourceSnippetParameters.builder()
                                .tag("User")
                                .summary("현재 사용자 조회")
                                .description(CURRENT_USER_DESCRIPTION)
                                .responseSchema(schema("CurrentUserResponse"))
                                .requestHeaders(
                                        headerWithName(AUTHORIZATION)
                                                .description("로그인 시 발급된 access token")
                                )
                                .responseFields(
                                        fieldWithPath("id").description("사용자 ID"),
                                        fieldWithPath("nickname").description("사용자 닉네임")
                                )
                                .build())
                ));
    }

    @Test
    @DisplayName("다른 사용자 ID를 요청 파라미터로 전달해도 token 사용자의 정보를 반환한다")
    void shouldIgnoreRequestedUserIdAndFindTokenUser() throws Exception {
        mockMvc.perform(get("/api/users/me")
                        .header(AUTHORIZATION, bearerTokenOf(currentUserId, "current"))
                        .param("userId", otherUserId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(currentUserId))
                .andExpect(jsonPath("$.nickname").value("current"));
    }

    @Test
    @DisplayName("access token 없이 현재 사용자 정보를 요청하면 인증 필요 오류를 반환한다")
    void shouldRequireAuthenticationToFindCurrentUser() throws Exception {
        mockMvc.perform(get("/api/users/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201))
                .andExpect(jsonPath("$.message").value("로그인이 필요합니다."))
                .andExpect(jsonPath("$.status").doesNotExist());
    }

    @Test
    @DisplayName("token이 가리키는 사용자가 DB에 없으면 사용자 없음 오류를 반환한다")
    void shouldReturnUserNotFoundWhenTokenUserDoesNotExist() throws Exception {
        mockMvc.perform(get("/api/users/me")
                        .header(AUTHORIZATION, bearerTokenOf(Long.MAX_VALUE, "없는회원")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value(301));
    }

    @Test
    @DisplayName("현재 사용자의 결혼 예정일을 저장하고 조회한다")
    void shouldSaveAndFindCurrentUserWeddingDate() throws Exception {
        String token = bearerTokenOf(currentUserId, "current");

        mockMvc.perform(put("/api/users/me/wedding-date")
                        .header(AUTHORIZATION, token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new WeddingDateRequest(WEDDING_DATE))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weddingDate").value("2027-05-15"))
                .andDo(document(
                        "users-update-wedding-date",
                        resource(ResourceSnippetParameters.builder()
                                .tag("User")
                                .summary("결혼 예정일 저장")
                                .description(WEDDING_DATE_DESCRIPTION)
                                .requestSchema(schema("WeddingDateRequest"))
                                .responseSchema(schema("WeddingDateResponse"))
                                .requestHeaders(
                                        headerWithName(AUTHORIZATION)
                                                .description(DOCUMENTED_AUTHORIZATION_HEADER)
                                )
                                .requestFields(
                                        fieldWithPath("weddingDate").description("저장할 결혼 예정일")
                                )
                                .responseFields(
                                        fieldWithPath("weddingDate").description("저장된 결혼 예정일")
                                )
                                .build())
                ));

        mockMvc.perform(get("/api/users/me/wedding-date")
                        .header(AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weddingDate").value("2027-05-15"));
    }

    @Test
    @DisplayName("결혼 예정일을 설정하지 않은 사용자는 null을 조회한다")
    void shouldFindNullWhenWeddingDateIsNotSet() throws Exception {
        mockMvc.perform(get("/api/users/me/wedding-date")
                        .header(AUTHORIZATION, bearerTokenOf(currentUserId, "current")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weddingDate").value((Object) null));
    }

    @Test
    @DisplayName("과거인 동일한 결혼 예정일도 반복해서 저장한다")
    void shouldSaveSamePastWeddingDateRepeatedly() throws Exception {
        String token = bearerTokenOf(currentUserId, "current");
        String request = objectMapper.writeValueAsString(
                new WeddingDateRequest(PAST_WEDDING_DATE));

        mockMvc.perform(put("/api/users/me/wedding-date")
                        .header(AUTHORIZATION, token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/users/me/wedding-date")
                        .header(AUTHORIZATION, token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weddingDate").value("2020-01-01"));
    }

    @Test
    @DisplayName("결혼 예정일이 누락되면 요청을 거절한다")
    void shouldRejectMissingWeddingDate() throws Exception {
        mockMvc.perform(put("/api/users/me/wedding-date")
                        .header(AUTHORIZATION, bearerTokenOf(currentUserId, "current"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new WeddingDateRequest(null))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("잘못된 결혼 예정일 형식은 요청을 거절한다")
    void shouldRejectInvalidWeddingDateFormat() throws Exception {
        ObjectNode request = objectMapper.valueToTree(
                new WeddingDateRequest(WEDDING_DATE));
        request.put("weddingDate", "2027-13-40");

        mockMvc.perform(put("/api/users/me/wedding-date")
                        .header(AUTHORIZATION, bearerTokenOf(currentUserId, "current"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("access token이 없으면 결혼 예정일을 저장하거나 조회할 수 없다")
    void shouldRequireAuthenticationForWeddingDate() throws Exception {
        mockMvc.perform(put("/api/users/me/wedding-date")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new WeddingDateRequest(WEDDING_DATE))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201));

        mockMvc.perform(get("/api/users/me/wedding-date"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201));
    }

    @Test
    @DisplayName("닉네임을 변경해도 사용자 ID와 결혼 예정일을 유지한다")
    void shouldChangeNicknameAndKeepIdentityAndWeddingDate() throws Exception {
        String token = bearerTokenOf(currentUserId, "current");

        mockMvc.perform(put("/api/users/me/wedding-date")
                        .header(AUTHORIZATION, token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new WeddingDateRequest(WEDDING_DATE))))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/users/me/nickname")
                        .header(AUTHORIZATION, token)
                        .param("userId", otherUserId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ChangeNicknameRequest("new-name"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(currentUserId))
                .andExpect(jsonPath("$.nickname").value("new-name"))
                .andDo(document(
                        "users-change-nickname",
                        resource(ResourceSnippetParameters.builder()
                                .tag("User")
                                .summary("닉네임 변경")
                                .description(CHANGE_NICKNAME_DESCRIPTION)
                                .requestSchema(schema("ChangeNicknameRequest"))
                                .responseSchema(schema("ChangeNicknameResponse"))
                                .requestHeaders(
                                        headerWithName(AUTHORIZATION)
                                                .description(DOCUMENTED_AUTHORIZATION_HEADER)
                                )
                                .requestFields(
                                        fieldWithPath("nickname").description("새 닉네임")
                                )
                                .responseFields(
                                        fieldWithPath("id").description("변경되지 않은 사용자 ID"),
                                        fieldWithPath("nickname").description("변경된 사용자 닉네임")
                                )
                                .build())
                ));

        mockMvc.perform(get("/api/users/me/wedding-date")
                        .header(AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weddingDate").value("2027-05-15"));
    }

    @Test
    @DisplayName("소셜에서 받은 닉네임이 겹쳐도 가입을 막지 않는다")
    void shouldAllowDuplicatedNickname() {
        Long duplicated = createActiveUser("current");

        org.assertj.core.api.Assertions.assertThat(duplicated).isNotEqualTo(currentUserId);
    }

    private Long createActiveUser(String nickname) {
        UserResult created = userService.createPendingUser(nickname, null);
        userService.activate(created.id());
        return created.id();
    }

    private String bearerTokenOf(Long userId, String nickname) {
        return AuthenticationTestSupport.bearerTokenOf(
                bibbidiTokenIssuer,
                userId,
                nickname);
    }
}
