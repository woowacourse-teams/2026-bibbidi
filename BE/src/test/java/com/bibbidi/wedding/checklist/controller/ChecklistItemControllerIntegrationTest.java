package com.bibbidi.wedding.checklist.controller;

import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.headerWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.parameterWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.documentationConfiguration;
import static org.springframework.restdocs.mockmvc.RestDocumentationRequestBuilders.put;
import static org.springframework.restdocs.payload.PayloadDocumentation.fieldWithPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

import com.bibbidi.wedding.auth.session.AuthSession;
import com.bibbidi.wedding.checklist.controller.dto.ChangeChecklistItemCategoryRequest;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
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
@Sql("/checklist-item-category-fixture.sql")
@ExtendWith(RestDocumentationExtension.class)
class ChecklistItemControllerIntegrationTest {

    private static final String CHANGE_CATEGORY_URL = "/api/checklist-items/{itemId}/category";
    private static final Long USER_ID = 7L;
    private static final Long CUSTOM_ITEM_ID = 500L;
    private static final Long CATALOG_SOURCED_ITEM_ID = 501L;
    private static final Long DONE_CUSTOM_ITEM_ID = 502L;
    private static final Long OTHER_USERS_ITEM_ID = 503L;
    private static final Long CURRENT_CATEGORY_ID = 2L;
    private static final Long NEW_CATEGORY_ID = 3L;

    private static final String DOCUMENTED_SESSION_COOKIE = "JSESSIONID=<session-id>";
    private static final String SESSION_COOKIE_DESCRIPTION =
            "로그인 시 발급된 JSESSIONID Session Cookie";
    private static final String CHANGE_CATEGORY_SUMMARY = "직접 만든 할 일의 카테고리 변경";
    private static final String CHANGE_CATEGORY_DESCRIPTION =
            "직접 만든 할 일의 카테고리만 바꿉니다. 제목과 완료 상태, 연결된 일정은 그대로 유지합니다. "
                    + "준비 목록에서 추가한 할 일은 원본과 카테고리가 어긋나므로 변경할 수 없습니다.";

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

    private String requestBody(Long categoryId) {
        return objectMapper.writeValueAsString(new ChangeChecklistItemCategoryRequest(categoryId));
    }

    @Test
    @DisplayName("직접 만든 할 일의 카테고리를 변경한다")
    void shouldChangeCategoryOfCustomItem() throws Exception {
        // when, then
        mockMvc.perform(put(CHANGE_CATEGORY_URL, CUSTOM_ITEM_ID)
                        .session(authenticatedSession())
                        .header(HttpHeaders.COOKIE, DOCUMENTED_SESSION_COOKIE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody(NEW_CATEGORY_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(CUSTOM_ITEM_ID))
                .andExpect(jsonPath("$.catalogItemId").value(nullValue()))
                .andExpect(jsonPath("$.categoryId").value(NEW_CATEGORY_ID))
                .andExpect(jsonPath("$.title").value("청첩장 문구 정하기"))
                .andExpect(jsonPath("$.isDone").value(false))
                .andDo(document(
                        "checklist-items-change-category",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Checklist")
                                .summary(CHANGE_CATEGORY_SUMMARY)
                                .description(CHANGE_CATEGORY_DESCRIPTION)
                                .requestSchema(schema("ChangeChecklistItemCategoryRequest"))
                                .responseSchema(schema("ChecklistItemResponse"))
                                .requestHeaders(
                                        headerWithName(HttpHeaders.COOKIE)
                                                .description(SESSION_COOKIE_DESCRIPTION)
                                )
                                .pathParameters(
                                        parameterWithName("itemId").description("카테고리를 바꿀 할 일 ID")
                                )
                                .requestFields(
                                        fieldWithPath("categoryId").description("새로 지정할 카테고리 ID")
                                )
                                .responseFields(
                                        fieldWithPath("id").description("할 일 ID"),
                                        fieldWithPath("catalogItemId")
                                                .description("원본 준비 항목 ID. 직접 만든 할 일만 변경할 수 있으므로 항상 null"),
                                        fieldWithPath("categoryId").description("변경된 카테고리 ID"),
                                        fieldWithPath("title").description("할 일 제목"),
                                        fieldWithPath("isDone").description("완료 여부")
                                )
                                .build())
                ));
    }

    @Test
    @DisplayName("완료한 할 일도 카테고리를 변경할 수 있고 제목과 완료 상태는 그대로다")
    void shouldChangeCategoryOfDoneItemAndKeepOtherInformation() throws Exception {
        // when, then
        mockMvc.perform(put(CHANGE_CATEGORY_URL, DONE_CUSTOM_ITEM_ID)
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody(NEW_CATEGORY_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.categoryId").value(NEW_CATEGORY_ID))
                .andExpect(jsonPath("$.title").value("식순 정하기"))
                .andExpect(jsonPath("$.isDone").value(true));
    }

    @Test
    @DisplayName("이미 그 카테고리인 할 일도 그대로 변경에 성공한다")
    void shouldAcceptChangeToSameCategory() throws Exception {
        // when, then
        mockMvc.perform(put(CHANGE_CATEGORY_URL, CUSTOM_ITEM_ID)
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody(CURRENT_CATEGORY_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.categoryId").value(CURRENT_CATEGORY_ID));
    }

    @Test
    @DisplayName("준비 목록에서 추가한 할 일은 카테고리를 변경할 수 없다")
    void shouldRejectChangeForItemAddedFromCatalog() throws Exception {
        // when, then
        mockMvc.perform(put(CHANGE_CATEGORY_URL, CATALOG_SOURCED_ITEM_ID)
                        .session(authenticatedSession())
                        .header(HttpHeaders.COOKIE, DOCUMENTED_SESSION_COOKIE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody(NEW_CATEGORY_ID)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errorCode").value(404))
                .andExpect(jsonPath("$.message").value("준비 목록에서 추가한 할 일은 카테고리를 변경할 수 없습니다."))
                .andDo(document(
                        "checklist-items-change-category-not-changeable",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Checklist")
                                .summary(CHANGE_CATEGORY_SUMMARY)
                                .description(CHANGE_CATEGORY_DESCRIPTION)
                                .responseSchema(schema("ErrorResponse"))
                                .requestHeaders(
                                        headerWithName(HttpHeaders.COOKIE)
                                                .description(SESSION_COOKIE_DESCRIPTION)
                                )
                                .pathParameters(
                                        parameterWithName("itemId").description("카테고리를 바꿀 할 일 ID")
                                )
                                .requestFields(
                                        fieldWithPath("categoryId").description("새로 지정할 카테고리 ID")
                                )
                                .responseFields(
                                        fieldWithPath("errorCode").description("오류 코드"),
                                        fieldWithPath("message").description("오류 메시지")
                                )
                                .build())
                ));
    }

    @Test
    @DisplayName("다른 사용자의 할 일은 카테고리를 변경할 수 없다")
    void shouldRejectChangeForOtherUsersItem() throws Exception {
        // when, then
        mockMvc.perform(put(CHANGE_CATEGORY_URL, OTHER_USERS_ITEM_ID)
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody(NEW_CATEGORY_ID)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value(203))
                .andExpect(jsonPath("$.message").value("해당 할 일에 대한 작업 권한이 없습니다."));
    }

    @Test
    @DisplayName("없는 할 일은 카테고리를 변경할 수 없다")
    void shouldRejectChangeWhenItemDoesNotExist() throws Exception {
        // when, then
        mockMvc.perform(put(CHANGE_CATEGORY_URL, 9999L)
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody(NEW_CATEGORY_ID)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value(304))
                .andExpect(jsonPath("$.message").value("할 일을 찾을 수 없습니다."));
    }

    @Test
    @DisplayName("준비 목록에 없는 카테고리로는 변경할 수 없다")
    void shouldRejectChangeWhenCategoryDoesNotExist() throws Exception {
        // when, then
        mockMvc.perform(put(CHANGE_CATEGORY_URL, CUSTOM_ITEM_ID)
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody(999L)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value(305))
                .andExpect(jsonPath("$.message").value("카테고리를 찾을 수 없습니다."));
    }

    @Test
    @DisplayName("카테고리를 지정하지 않으면 변경할 수 없다")
    void shouldRejectChangeWhenCategoryIsMissing() throws Exception {
        // when, then
        mockMvc.perform(put(CHANGE_CATEGORY_URL, CUSTOM_ITEM_ID)
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody(null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(101));
    }

    @Test
    @DisplayName("인증 Session이 없으면 카테고리를 변경할 수 없다")
    void shouldRequireAuthenticationToChangeCategory() throws Exception {
        // when, then
        mockMvc.perform(put(CHANGE_CATEGORY_URL, CUSTOM_ITEM_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody(NEW_CATEGORY_ID)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201))
                .andExpect(jsonPath("$.message").value("로그인이 필요합니다."));
    }
}
