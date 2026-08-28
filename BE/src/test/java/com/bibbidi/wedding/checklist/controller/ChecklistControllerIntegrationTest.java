package com.bibbidi.wedding.checklist.controller;

import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.headerWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.documentationConfiguration;
import static org.springframework.restdocs.payload.PayloadDocumentation.fieldWithPath;
import static org.springframework.restdocs.payload.PayloadDocumentation.requestFields;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

import com.bibbidi.wedding.auth.session.AuthSession;
import com.bibbidi.wedding.checklist.controller.dto.AddCatalogItemsRequest;
import com.bibbidi.wedding.checklist.controller.dto.CreateChecklistItemRequest;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.restdocs.RestDocumentationContextProvider;
import org.springframework.restdocs.RestDocumentationExtension;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Sql("/checklist-fixture.sql")
@ExtendWith(RestDocumentationExtension.class)
class ChecklistControllerIntegrationTest {

    private static final Long USER_ID = 7L;
    private static final String DOCUMENTED_SESSION_COOKIE = "JSESSIONID=<session-id>";
    private static final String CREATE_SUMMARY = "빈 체크리스트 생성";
    private static final String CREATE_DESCRIPTION =
            "인증 Session의 사용자 ID를 소유자로 사용해 할 일이 없는 체크리스트를 생성합니다.";
    private static final String SESSION_COOKIE_DESCRIPTION =
            "로그인 시 발급된 JSESSIONID Session Cookie";
    private static final String WRITE_SUMMARY = "직접 할 일 생성";
    private static final String WRITE_DESCRIPTION =
            "준비 목록에 없는 할 일을 제목과 카테고리만으로 현재 사용자의 체크리스트에 추가합니다. "
                    + "원본 준비 항목이 없으므로 제목이 같은 할 일도 여러 번 추가할 수 있습니다.";
    private static final String ADD_SUMMARY = "준비 목록의 항목을 체크리스트에 추가";
    private static final String ADD_DESCRIPTION =
            "선택한 준비 항목의 제목과 카테고리를 복사해 현재 사용자의 체크리스트에 할 일로 추가합니다. "
                    + "이미 담긴 준비 항목이 포함되면 요청 전체가 실패합니다.";

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private ObjectMapper objectMapper;

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
                        )
                );
    }

    @Test
    @Sql("/checklist-catalog-fixture.sql")
    @DisplayName("선택한 준비 항목을 자신의 체크리스트에 할 일로 추가한다")
    void shouldAddSelectedCatalogItemsToOwnChecklist() throws Exception {
        // when, then
        mockMvc.perform(post("/api/checklists/me/catalog-items")
                        .session(authenticatedSession())
                        .header(HttpHeaders.COOKIE, DOCUMENTED_SESSION_COOKIE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AddCatalogItemsRequest(List.of(100L, 101L)))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.items[0].catalogItemId").value(100))
                .andExpect(jsonPath("$.items[0].categoryId").value(2))
                .andExpect(jsonPath("$.items[0].title").value("계약서 확인"))
                .andExpect(jsonPath("$.items[0].isDone").value(false))
                .andDo(document(
                        "checklists-add-catalog-items",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Checklist")
                                .summary(ADD_SUMMARY)
                                .description(ADD_DESCRIPTION)
                                .requestSchema(schema("AddCatalogItemsRequest"))
                                .responseSchema(schema("AddCatalogItemsResponse"))
                                .requestHeaders(
                                        headerWithName(HttpHeaders.COOKIE)
                                                .description(SESSION_COOKIE_DESCRIPTION)
                                )
                                .requestFields(
                                        fieldWithPath("catalogItemIds").description("추가할 준비 항목 ID 목록")
                                )
                                .responseFields(
                                        fieldWithPath("items[].id").description("생성된 할 일 ID"),
                                        fieldWithPath("items[].catalogItemId").description("원본 준비 항목 ID"),
                                        fieldWithPath("items[].categoryId").description("복사된 카테고리 ID"),
                                        fieldWithPath("items[].title").description("복사된 할 일 제목"),
                                        fieldWithPath("items[].isDone").description("완료 여부")
                                )
                                .build())
                ));
    }

    @Test
    @Sql("/checklist-catalog-fixture.sql")
    @DisplayName("이미 담은 준비 항목이 포함되면 요청 전체를 거절한다")
    void shouldRejectWhenCatalogItemAlreadyAdded() throws Exception {
        // given
        mockMvc.perform(post("/api/checklists/me/catalog-items")
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AddCatalogItemsRequest(List.of(100L)))))
                .andExpect(status().isCreated());

        // when, then
        mockMvc.perform(post("/api/checklists/me/catalog-items")
                        .session(authenticatedSession())
                        .header(HttpHeaders.COOKIE, DOCUMENTED_SESSION_COOKIE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AddCatalogItemsRequest(List.of(100L, 101L)))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value(403))
                .andExpect(jsonPath("$.message").value("이미 추가된 준비 항목입니다."))
                .andDo(document(
                        "checklists-add-catalog-items-conflict",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Checklist")
                                .summary(ADD_SUMMARY)
                                .description(ADD_DESCRIPTION)
                                .responseSchema(schema("ErrorResponse"))
                                .requestHeaders(
                                        headerWithName(HttpHeaders.COOKIE)
                                                .description(SESSION_COOKIE_DESCRIPTION)
                                )
                                .requestFields(
                                        fieldWithPath("catalogItemIds").description("추가할 준비 항목 ID 목록")
                                )
                                .responseFields(
                                        fieldWithPath("errorCode").description("오류 코드"),
                                        fieldWithPath("message").description("오류 메시지")
                                )
                                .build())
                ));
    }

    @Test
    @Sql("/checklist-catalog-fixture.sql")
    @DisplayName("준비 목록에 없는 항목이 포함되면 요청 전체를 거절한다")
    void shouldRejectWhenCatalogItemDoesNotExist() throws Exception {
        // when, then
        mockMvc.perform(post("/api/checklists/me/catalog-items")
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AddCatalogItemsRequest(List.of(100L, 999L)))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(101))
                .andExpect(jsonPath("$.message").value("요청 값이 올바르지 않습니다."));
    }

    @Test
    @DisplayName("체크리스트가 없는 사용자는 준비 항목을 추가할 수 없다")
    void shouldRejectAddWhenChecklistDoesNotExist() throws Exception {
        // when, then
        mockMvc.perform(post("/api/checklists/me/catalog-items")
                        .session(authenticatedSession())
                        .header(HttpHeaders.COOKIE, DOCUMENTED_SESSION_COOKIE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AddCatalogItemsRequest(List.of(100L)))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value(303))
                .andExpect(jsonPath("$.message").value("체크리스트를 찾을 수 없습니다."))
                .andDo(document(
                        "checklists-add-catalog-items-checklist-not-found",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Checklist")
                                .summary(ADD_SUMMARY)
                                .description(ADD_DESCRIPTION)
                                .responseSchema(schema("ErrorResponse"))
                                .requestHeaders(
                                        headerWithName(HttpHeaders.COOKIE)
                                                .description(SESSION_COOKIE_DESCRIPTION)
                                )
                                .requestFields(
                                        fieldWithPath("catalogItemIds").description("추가할 준비 항목 ID 목록")
                                )
                                .responseFields(
                                        fieldWithPath("errorCode").description("오류 코드"),
                                        fieldWithPath("message").description("오류 메시지")
                                )
                                .build())
                ));
    }

    @Test
    @Sql("/checklist-catalog-fixture.sql")
    @DisplayName("준비 목록에 없는 할 일을 자신의 체크리스트에 직접 추가한다")
    void shouldWriteCustomItemToOwnChecklist() throws Exception {
        // when, then
        mockMvc.perform(post("/api/checklists/me/items")
                        .session(authenticatedSession())
                        .header(HttpHeaders.COOKIE, DOCUMENTED_SESSION_COOKIE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateChecklistItemRequest("청첩장 문구 정하기", 2L))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.catalogItemId").value(nullValue()))
                .andExpect(jsonPath("$.categoryId").value(2))
                .andExpect(jsonPath("$.title").value("청첩장 문구 정하기"))
                .andExpect(jsonPath("$.isDone").value(false))
                .andDo(document(
                        "checklists-write-item",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Checklist")
                                .summary(WRITE_SUMMARY)
                                .description(WRITE_DESCRIPTION)
                                .requestSchema(schema("CreateChecklistItemRequest"))
                                .responseSchema(schema("CreateChecklistItemResponse"))
                                .requestHeaders(
                                        headerWithName(HttpHeaders.COOKIE)
                                                .description(SESSION_COOKIE_DESCRIPTION)
                                )
                                .requestFields(
                                        fieldWithPath("title").description("할 일 제목. 앞뒤 공백을 제거한 뒤 1자 이상 50자 이하"),
                                        fieldWithPath("categoryId").description("할 일이 속할 카테고리 ID")
                                )
                                .responseFields(
                                        fieldWithPath("id").description("생성된 할 일 ID"),
                                        fieldWithPath("catalogItemId").description("원본 준비 항목 ID. 직접 만든 할 일은 항상 null"),
                                        fieldWithPath("categoryId").description("할 일이 속한 카테고리 ID"),
                                        fieldWithPath("title").description("할 일 제목"),
                                        fieldWithPath("isDone").description("완료 여부")
                                )
                                .build())
                ));
    }

    @Test
    @Sql("/checklist-catalog-fixture.sql")
    @DisplayName("직접 만든 할 일은 제목이 같아도 여러 번 추가할 수 있다")
    void shouldAllowDuplicateTitleForCustomItems() throws Exception {
        // given
        mockMvc.perform(post("/api/checklists/me/items")
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateChecklistItemRequest("청첩장 문구 정하기", 2L))))
                .andExpect(status().isCreated());

        // when, then
        mockMvc.perform(post("/api/checklists/me/items")
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateChecklistItemRequest("청첩장 문구 정하기", 2L))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("청첩장 문구 정하기"));
    }

    @Test
    @Sql("/checklist-catalog-fixture.sql")
    @DisplayName("준비 목록에 없는 카테고리로는 직접 할 일을 만들 수 없다")
    void shouldRejectWriteWhenCategoryDoesNotExist() throws Exception {
        // when, then
        mockMvc.perform(post("/api/checklists/me/items")
                        .session(authenticatedSession())
                        .header(HttpHeaders.COOKIE, DOCUMENTED_SESSION_COOKIE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateChecklistItemRequest("청첩장 문구 정하기", 999L))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value(305))
                .andExpect(jsonPath("$.message").value("카테고리를 찾을 수 없습니다."))
                .andDo(document(
                        "checklists-write-item-category-not-found",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Checklist")
                                .summary(WRITE_SUMMARY)
                                .description(WRITE_DESCRIPTION)
                                .responseSchema(schema("ErrorResponse"))
                                .requestHeaders(
                                        headerWithName(HttpHeaders.COOKIE)
                                                .description(SESSION_COOKIE_DESCRIPTION)
                                )
                                .requestFields(
                                        fieldWithPath("title").description("할 일 제목"),
                                        fieldWithPath("categoryId").description("할 일이 속할 카테고리 ID")
                                )
                                .responseFields(
                                        fieldWithPath("errorCode").description("오류 코드"),
                                        fieldWithPath("message").description("오류 메시지")
                                )
                                .build())
                ));
    }

    @Test
    @Sql("/checklist-catalog-fixture.sql")
    @DisplayName("공백만 있는 제목은 저장하지 않는다")
    void shouldRejectBlankTitle() throws Exception {
        // when, then
        mockMvc.perform(post("/api/checklists/me/items")
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateChecklistItemRequest("   ", 2L))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(101))
                .andExpect(jsonPath("$.message").value("요청 값이 올바르지 않습니다."));
    }

    @Test
    @Sql("/checklist-catalog-fixture.sql")
    @DisplayName("50자를 넘는 제목은 저장하지 않는다")
    void shouldRejectTooLongTitle() throws Exception {
        // when, then
        mockMvc.perform(post("/api/checklists/me/items")
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateChecklistItemRequest("가".repeat(51), 2L))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(101));
    }

    @Test
    @DisplayName("체크리스트가 없는 사용자는 직접 할 일을 만들 수 없다")
    void shouldRejectWriteWhenChecklistDoesNotExist() throws Exception {
        // when, then
        mockMvc.perform(post("/api/checklists/me/items")
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateChecklistItemRequest("청첩장 문구 정하기", 2L))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value(303))
                .andExpect(jsonPath("$.message").value("체크리스트를 찾을 수 없습니다."));
    }

    @Test
    @DisplayName("인증 Session이 없으면 직접 할 일을 만들 수 없다")
    void shouldRequireAuthenticationToWriteItem() throws Exception {
        // when, then
        mockMvc.perform(post("/api/checklists/me/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateChecklistItemRequest("청첩장 문구 정하기", 2L))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201))
                .andExpect(jsonPath("$.message").value("로그인이 필요합니다."));
    }
}
