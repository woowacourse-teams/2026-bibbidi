package com.bibbidi.wedding.checklist.controller;

import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.headerWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.parameterWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.documentationConfiguration;
import static org.springframework.restdocs.mockmvc.RestDocumentationRequestBuilders.delete;
import static org.springframework.restdocs.mockmvc.RestDocumentationRequestBuilders.put;
import static org.springframework.restdocs.payload.PayloadDocumentation.fieldWithPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

import com.bibbidi.wedding.auth.session.AuthSession;
import com.bibbidi.wedding.appointment.persistence.JpaAppointmentRepository;
import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemSnapshot;
import com.bibbidi.wedding.checklist.controller.dto.ChangeChecklistItemCategoryRequest;
import com.bibbidi.wedding.checklist.controller.dto.ChangeChecklistItemTitleRequest;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemRepository;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import java.util.List;
import java.util.Set;
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
@Sql("/checklist-item-fixture.sql")
@ExtendWith(RestDocumentationExtension.class)
class ChecklistItemControllerIntegrationTest {

    private static final String CHANGE_CATEGORY_URL = "/api/checklist-items/{itemId}/category";
    private static final String CHANGE_TITLE_URL = "/api/checklist-items/{itemId}/title";
    private static final String DELETE_ITEM_URL = "/api/checklist-items/{itemId}";
    private static final Long USER_ID = 7L;
    private static final Long CUSTOM_ITEM_ID = 500L;
    private static final Long CATALOG_SOURCED_ITEM_ID = 501L;
    private static final Long DONE_CUSTOM_ITEM_ID = 502L;
    private static final Long OTHER_USERS_ITEM_ID = 503L;
    private static final Long CURRENT_CATEGORY_ID = 2L;
    private static final Long NEW_CATEGORY_ID = 3L;
    private static final Long SOURCE_CATALOG_ITEM_ID = 100L;
    private static final Long FIRST_CUSTOM_ITEM_APPOINTMENT_ID = 800L;
    private static final Long SECOND_CUSTOM_ITEM_APPOINTMENT_ID = 801L;
    private static final Long CATALOG_SOURCED_ITEM_APPOINTMENT_ID = 802L;
    private static final Long DONE_ITEM_APPOINTMENT_ID = 803L;
    private static final String NEW_TITLE = "청첩장 문구 최종 확정";

    private static final String DOCUMENTED_SESSION_COOKIE = "JSESSIONID=<session-id>";
    private static final String SESSION_COOKIE_DESCRIPTION =
            "로그인 시 발급된 JSESSIONID Session Cookie";
    private static final String CHANGE_CATEGORY_SUMMARY = "직접 만든 할 일의 카테고리 변경";
    private static final String CHANGE_CATEGORY_DESCRIPTION =
            "직접 만든 할 일의 카테고리만 바꿉니다. 제목과 완료 상태, 연결된 일정은 그대로 유지합니다. "
                    + "준비 목록에서 추가한 할 일은 원본과 카테고리가 어긋나므로 변경할 수 없습니다.";
    private static final String CHANGE_TITLE_SUMMARY = "직접 만든 할 일의 제목 변경";
    private static final String CHANGE_TITLE_DESCRIPTION =
            "직접 만든 할 일의 제목만 바꿉니다. 카테고리와 완료 상태, 연결된 일정은 그대로 유지합니다. "
                    + "준비 목록에서 추가한 할 일은 원본 제목을 따라야 하므로 변경할 수 없습니다.";
    private static final String DELETE_ITEM_SUMMARY = "미완료 할 일 삭제";
    private static final String DELETE_ITEM_DESCRIPTION =
            "자신이 소유한 미완료 할 일과 연결된 일정을 함께 삭제합니다. "
                    + "완료된 할 일은 삭제할 수 없고, 이미 없는 할 일은 삭제된 것으로 처리합니다.";

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private CatalogService catalogService;

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

    private String requestBody(Long categoryId) {
        return objectMapper.writeValueAsString(new ChangeChecklistItemCategoryRequest(categoryId));
    }

    private String titleRequestBody(String title) {
        return objectMapper.writeValueAsString(new ChangeChecklistItemTitleRequest(title));
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
                                .requestSchema(schema("ChangeChecklistItemCategoryRequest"))
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

    @Test
    @DisplayName("직접 만든 할 일의 제목을 변경한다")
    void shouldChangeTitleOfCustomItem() throws Exception {
        // when, then
        mockMvc.perform(put(CHANGE_TITLE_URL, CUSTOM_ITEM_ID)
                        .session(authenticatedSession())
                        .header(HttpHeaders.COOKIE, DOCUMENTED_SESSION_COOKIE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(titleRequestBody(NEW_TITLE)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(CUSTOM_ITEM_ID))
                .andExpect(jsonPath("$.catalogItemId").value(nullValue()))
                .andExpect(jsonPath("$.categoryId").value(CURRENT_CATEGORY_ID))
                .andExpect(jsonPath("$.title").value(NEW_TITLE))
                .andExpect(jsonPath("$.isDone").value(false))
                .andDo(document(
                        "checklist-items-change-title",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Checklist")
                                .summary(CHANGE_TITLE_SUMMARY)
                                .description(CHANGE_TITLE_DESCRIPTION)
                                .requestSchema(schema("ChangeChecklistItemTitleRequest"))
                                .responseSchema(schema("ChecklistItemResponse"))
                                .requestHeaders(
                                        headerWithName(HttpHeaders.COOKIE)
                                                .description(SESSION_COOKIE_DESCRIPTION)
                                )
                                .pathParameters(
                                        parameterWithName("itemId").description("제목을 바꿀 할 일 ID")
                                )
                                .requestFields(
                                        fieldWithPath("title").description("새로 지정할 제목. 공백만 보낼 수 없고 50자를 넘을 수 없다")
                                )
                                .responseFields(
                                        fieldWithPath("id").description("할 일 ID"),
                                        fieldWithPath("catalogItemId")
                                                .description("원본 준비 항목 ID. 직접 만든 할 일만 변경할 수 있으므로 항상 null"),
                                        fieldWithPath("categoryId").description("할 일 카테고리 ID"),
                                        fieldWithPath("title").description("변경된 할 일 제목"),
                                        fieldWithPath("isDone").description("완료 여부")
                                )
                                .build())
                ));
    }

    @Test
    @DisplayName("완료한 할 일도 제목을 변경할 수 있고 카테고리와 완료 상태는 그대로다")
    void shouldChangeTitleOfDoneItemAndKeepOtherInformation() throws Exception {
        // when, then
        mockMvc.perform(put(CHANGE_TITLE_URL, DONE_CUSTOM_ITEM_ID)
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(titleRequestBody(NEW_TITLE)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value(NEW_TITLE))
                .andExpect(jsonPath("$.categoryId").value(CURRENT_CATEGORY_ID))
                .andExpect(jsonPath("$.isDone").value(true));
    }

    @Test
    @DisplayName("이미 그 제목인 할 일도 그대로 변경에 성공한다")
    void shouldAcceptChangeToSameTitle() throws Exception {
        // when, then
        mockMvc.perform(put(CHANGE_TITLE_URL, CUSTOM_ITEM_ID)
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(titleRequestBody("청첩장 문구 정하기")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("청첩장 문구 정하기"));
    }

    @Test
    @DisplayName("준비 목록에서 추가한 할 일은 제목을 변경할 수 없다")
    void shouldRejectTitleChangeForItemAddedFromCatalog() throws Exception {
        // when, then
        mockMvc.perform(put(CHANGE_TITLE_URL, CATALOG_SOURCED_ITEM_ID)
                        .session(authenticatedSession())
                        .header(HttpHeaders.COOKIE, DOCUMENTED_SESSION_COOKIE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(titleRequestBody(NEW_TITLE)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errorCode").value(405))
                .andExpect(jsonPath("$.message").value("준비 목록에서 추가한 할 일은 제목을 변경할 수 없습니다."))
                .andDo(document(
                        "checklist-items-change-title-not-changeable",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Checklist")
                                .summary(CHANGE_TITLE_SUMMARY)
                                .description(CHANGE_TITLE_DESCRIPTION)
                                .requestSchema(schema("ChangeChecklistItemTitleRequest"))
                                .responseSchema(schema("ErrorResponse"))
                                .requestHeaders(
                                        headerWithName(HttpHeaders.COOKIE)
                                                .description(SESSION_COOKIE_DESCRIPTION)
                                )
                                .pathParameters(
                                        parameterWithName("itemId").description("제목을 바꿀 할 일 ID")
                                )
                                .requestFields(
                                        fieldWithPath("title").description("새로 지정할 제목")
                                )
                                .responseFields(
                                        fieldWithPath("errorCode").description("오류 코드"),
                                        fieldWithPath("message").description("오류 메시지")
                                )
                                .build())
                ));
    }

    @Test
    @DisplayName("제목 변경이 거절되어도 원본 준비 항목의 제목은 그대로다")
    void shouldKeepSourceCatalogItemTitleWhenTitleChangeIsRejected() throws Exception {
        // when
        mockMvc.perform(put(CHANGE_TITLE_URL, CATALOG_SOURCED_ITEM_ID)
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(titleRequestBody(NEW_TITLE)))
                .andExpect(status().isUnprocessableEntity());

        // then
        List<CatalogItemSnapshot> catalogItems = catalogService.findItems(Set.of(SOURCE_CATALOG_ITEM_ID));
        assertThat(catalogItems)
                .extracting(CatalogItemSnapshot::title)
                .containsExactly("계약서 확인");
    }

    @Test
    @DisplayName("다른 사용자의 할 일은 제목을 변경할 수 없다")
    void shouldRejectTitleChangeForOtherUsersItem() throws Exception {
        // when, then
        mockMvc.perform(put(CHANGE_TITLE_URL, OTHER_USERS_ITEM_ID)
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(titleRequestBody(NEW_TITLE)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value(203))
                .andExpect(jsonPath("$.message").value("해당 할 일에 대한 작업 권한이 없습니다."));
    }

    @Test
    @DisplayName("없는 할 일은 제목을 변경할 수 없다")
    void shouldRejectTitleChangeWhenItemDoesNotExist() throws Exception {
        // when, then
        mockMvc.perform(put(CHANGE_TITLE_URL, 9999L)
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(titleRequestBody(NEW_TITLE)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value(304))
                .andExpect(jsonPath("$.message").value("할 일을 찾을 수 없습니다."));
    }

    @Test
    @DisplayName("공백만 있는 제목으로는 변경할 수 없다")
    void shouldRejectTitleChangeWhenTitleIsBlank() throws Exception {
        // when, then
        mockMvc.perform(put(CHANGE_TITLE_URL, CUSTOM_ITEM_ID)
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(titleRequestBody("   ")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(101));
    }

    @Test
    @DisplayName("50자를 넘는 제목으로는 변경할 수 없다")
    void shouldRejectTitleChangeWhenTitleIsTooLong() throws Exception {
        // when, then
        mockMvc.perform(put(CHANGE_TITLE_URL, CUSTOM_ITEM_ID)
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(titleRequestBody("가".repeat(51))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(101));
    }

    @Test
    @DisplayName("인증 Session이 없으면 제목을 변경할 수 없다")
    void shouldRequireAuthenticationToChangeTitle() throws Exception {
        // when, then
        mockMvc.perform(put(CHANGE_TITLE_URL, CUSTOM_ITEM_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(titleRequestBody(NEW_TITLE)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201))
                .andExpect(jsonPath("$.message").value("로그인이 필요합니다."));
    }

    @Test
    @DisplayName("미완료 할 일과 연결된 일정을 함께 삭제한다")
    void shouldDeleteIncompleteItemAndAppointments() throws Exception {
        // when
        mockMvc.perform(delete(DELETE_ITEM_URL, CUSTOM_ITEM_ID)
                        .session(authenticatedSession())
                        .header(HttpHeaders.COOKIE, DOCUMENTED_SESSION_COOKIE))
                .andExpect(status().isNoContent())
                .andDo(document(
                        "checklist-items-delete",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Checklist")
                                .summary(DELETE_ITEM_SUMMARY)
                                .description(DELETE_ITEM_DESCRIPTION)
                                .requestHeaders(
                                        headerWithName(HttpHeaders.COOKIE)
                                                .description(SESSION_COOKIE_DESCRIPTION)
                                )
                                .pathParameters(
                                        parameterWithName("itemId").description("삭제할 미완료 할 일 ID")
                                )
                                .build())
                ));

        // then
        assertThat(jpaChecklistItemRepository.findById(CUSTOM_ITEM_ID)).isEmpty();
        assertThat(jpaAppointmentRepository.findAllById(List.of(
                FIRST_CUSTOM_ITEM_APPOINTMENT_ID,
                SECOND_CUSTOM_ITEM_APPOINTMENT_ID
        ))).isEmpty();
    }

    @Test
    @DisplayName("준비 목록에서 가져온 미완료 할 일은 삭제하지만 원본 준비 항목은 유지한다")
    void shouldDeleteCatalogSourcedItemAndKeepCatalogItem() throws Exception {
        // when
        mockMvc.perform(delete(DELETE_ITEM_URL, CATALOG_SOURCED_ITEM_ID)
                        .session(authenticatedSession()))
                .andExpect(status().isNoContent());

        // then
        assertThat(jpaChecklistItemRepository.findById(CATALOG_SOURCED_ITEM_ID)).isEmpty();
        assertThat(jpaAppointmentRepository.findById(CATALOG_SOURCED_ITEM_APPOINTMENT_ID)).isEmpty();
        assertThat(catalogService.findItems(Set.of(SOURCE_CATALOG_ITEM_ID)))
                .extracting(CatalogItemSnapshot::id)
                .containsExactly(SOURCE_CATALOG_ITEM_ID);
    }

    @Test
    @DisplayName("완료된 할 일은 삭제할 수 없다")
    void shouldRejectDeletionWhenItemIsDone() throws Exception {
        // when, then
        mockMvc.perform(delete(DELETE_ITEM_URL, DONE_CUSTOM_ITEM_ID)
                        .session(authenticatedSession())
                        .header(HttpHeaders.COOKIE, DOCUMENTED_SESSION_COOKIE))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errorCode").value(406))
                .andExpect(jsonPath("$.message").value("완료된 할 일은 삭제할 수 없습니다."))
                .andDo(document(
                        "checklist-items-delete-completed",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Checklist")
                                .summary(DELETE_ITEM_SUMMARY)
                                .description(DELETE_ITEM_DESCRIPTION)
                                .responseSchema(schema("ErrorResponse"))
                                .requestHeaders(
                                        headerWithName(HttpHeaders.COOKIE)
                                                .description(SESSION_COOKIE_DESCRIPTION)
                                )
                                .pathParameters(
                                        parameterWithName("itemId").description("삭제할 할 일 ID")
                                )
                                .responseFields(
                                        fieldWithPath("errorCode").description("오류 코드"),
                                        fieldWithPath("message").description("오류 메시지")
                                )
                                .build())
                ));
        assertThat(jpaChecklistItemRepository.findById(DONE_CUSTOM_ITEM_ID)).isPresent();
        assertThat(jpaAppointmentRepository.findById(DONE_ITEM_APPOINTMENT_ID)).isPresent();
    }

    @Test
    @DisplayName("다른 사용자의 할 일은 삭제할 수 없다")
    void shouldRejectDeletionWhenItemBelongsToAnotherUser() throws Exception {
        // when, then
        mockMvc.perform(delete(DELETE_ITEM_URL, OTHER_USERS_ITEM_ID)
                        .session(authenticatedSession()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value(203))
                .andExpect(jsonPath("$.message").value("해당 할 일에 대한 작업 권한이 없습니다."));
        assertThat(jpaChecklistItemRepository.findById(OTHER_USERS_ITEM_ID)).isPresent();
    }

    @Test
    @DisplayName("없는 할 일은 이미 삭제된 것으로 처리한다")
    void shouldTreatMissingItemAsAlreadyDeleted() throws Exception {
        // when, then
        mockMvc.perform(delete(DELETE_ITEM_URL, 9999L)
                        .session(authenticatedSession()))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete(DELETE_ITEM_URL, 9999L)
                        .session(authenticatedSession()))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("인증 Session이 없으면 할 일을 삭제할 수 없다")
    void shouldRequireAuthenticationToDeleteItem() throws Exception {
        // when, then
        mockMvc.perform(delete(DELETE_ITEM_URL, CUSTOM_ITEM_ID))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201))
                .andExpect(jsonPath("$.message").value("로그인이 필요합니다."));
    }
}
