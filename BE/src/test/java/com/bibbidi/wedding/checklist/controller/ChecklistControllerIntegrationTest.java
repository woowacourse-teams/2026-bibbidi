package com.bibbidi.wedding.checklist.controller;

import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.headerWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.documentationConfiguration;
import static org.springframework.restdocs.payload.PayloadDocumentation.fieldWithPath;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

import com.bibbidi.wedding.appointment.persistence.JpaAppointmentRepository;
import com.bibbidi.wedding.auth.session.AuthSession;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemRepository;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistRepository;
import com.bibbidi.wedding.user.persistence.JpaUserEntity;
import com.bibbidi.wedding.user.persistence.JpaUserRepository;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.restdocs.RestDocumentationContextProvider;
import org.springframework.restdocs.RestDocumentationExtension;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Sql("/checklist-fixture.sql")
@ExtendWith(RestDocumentationExtension.class)
class ChecklistControllerIntegrationTest {

    private static final Long USER_ID = 7L;
    private static final String USER_NICKNAME = "bibbidi";
    private static final String DOCUMENTED_SESSION_COOKIE = "JSESSIONID=<session-id>";
    private static final String CREATE_SUMMARY = "빈 체크리스트 생성";
    private static final String CREATE_DESCRIPTION =
            "인증 Session의 사용자 ID를 소유자로 사용해 할 일이 없는 체크리스트를 생성합니다.";
    private static final String SESSION_COOKIE_DESCRIPTION =
            "로그인 시 발급된 JSESSIONID Session Cookie";

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private JpaUserRepository jpaUserRepository;

    @Autowired
    private JpaChecklistRepository jpaChecklistRepository;

    @Autowired
    private JpaChecklistItemRepository jpaChecklistItemRepository;

    @Autowired
    private JpaAppointmentRepository jpaAppointmentRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp(RestDocumentationContextProvider restDocumentation) {
        mockMvc = webAppContextSetup(context)
                .apply(documentationConfiguration(restDocumentation))
                .build();
    }

    private static MockHttpSession authenticatedSession() {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(AuthSession.USER_ID_ATTRIBUTE, USER_ID);
        return session;
    }

    @Test
    @DisplayName("인증된 사용자는 자신이 소유한 빈 체크리스트를 생성한다")
    void shouldCreateEmptyChecklistForAuthenticatedUser() throws Exception {
        // when, then
        mockMvc.perform(post("/api/checklists")
                        .session(authenticatedSession())
                        .header(HttpHeaders.COOKIE, DOCUMENTED_SESSION_COOKIE))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andDo(document(
                        "checklists-create",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Checklist")
                                .summary(CREATE_SUMMARY)
                                .description(CREATE_DESCRIPTION)
                                .responseSchema(schema("ChecklistCreationResponse"))
                                .requestHeaders(
                                        headerWithName(HttpHeaders.COOKIE)
                                                .description(SESSION_COOKIE_DESCRIPTION)
                                )
                                .responseFields(
                                        fieldWithPath("id").description("생성된 체크리스트 ID")
                                )
                                .build())
                ));

        assertThat(jpaChecklistRepository.findAll())
                .singleElement()
                .extracting(JpaChecklistEntity::ownerId)
                .isEqualTo(USER_ID);
        assertThat(jpaChecklistItemRepository.count()).isZero();
        assertThat(jpaAppointmentRepository.count()).isZero();
    }

    @Test
    @DisplayName("이미 체크리스트를 가진 사용자의 생성 요청은 거절하고 사용자 계정은 유지한다")
    void shouldRejectDuplicateChecklistAndKeepUser() throws Exception {
        // given
        MockHttpSession session = authenticatedSession();
        mockMvc.perform(post("/api/checklists")
                        .session(session)
                        .header(HttpHeaders.COOKIE, DOCUMENTED_SESSION_COOKIE))
                .andExpect(status().isCreated());

        // when, then
        mockMvc.perform(post("/api/checklists")
                        .session(session)
                        .header(HttpHeaders.COOKIE, DOCUMENTED_SESSION_COOKIE))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value(402))
                .andExpect(jsonPath("$.message").value("이미 체크리스트가 존재합니다."))
                .andDo(document(
                        "checklists-create-conflict",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Checklist")
                                .summary(CREATE_SUMMARY)
                                .description(CREATE_DESCRIPTION)
                                .responseSchema(schema("ErrorResponse"))
                                .requestHeaders(
                                        headerWithName(HttpHeaders.COOKIE)
                                                .description(SESSION_COOKIE_DESCRIPTION)
                                )
                                .responseFields(
                                        fieldWithPath("errorCode").description("오류 코드"),
                                        fieldWithPath("message").description("오류 메시지")
                                )
                                .build())
                ));

        assertThat(jpaChecklistRepository.count()).isOne();
        assertThat(jpaUserRepository.findById(USER_ID))
                .get()
                .extracting(JpaUserEntity::nickname)
                .isEqualTo(USER_NICKNAME);
    }

    @Test
    @DisplayName("인증 Session이 없으면 체크리스트를 생성할 수 없다")
    void shouldRequireAuthenticationToCreateChecklist() throws Exception {
        // when, then
        mockMvc.perform(post("/api/checklists"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201))
                .andExpect(jsonPath("$.message").value("로그인이 필요합니다."))
                .andDo(document(
                        "checklists-create-authentication-required",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Checklist")
                                .summary(CREATE_SUMMARY)
                                .description(CREATE_DESCRIPTION)
                                .responseSchema(schema("ErrorResponse"))
                                .responseFields(
                                        fieldWithPath("errorCode").description("오류 코드"),
                                        fieldWithPath("message").description("오류 메시지")
                                )
                                .build())
                ));

        assertThat(jpaChecklistRepository.count()).isZero();
    }
}
