package com.bibbidi.wedding.catalog.controller;

import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.documentationConfiguration;
import static org.springframework.restdocs.payload.PayloadDocumentation.fieldWithPath;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

import com.bibbidi.wedding.auth.session.AuthSession;
import com.bibbidi.wedding.catalog.persistence.JpaCatalogItemEntity;
import com.bibbidi.wedding.catalog.persistence.JpaCatalogItemRepository;
import com.bibbidi.wedding.catalog.persistence.JpaCategoryEntity;
import com.bibbidi.wedding.catalog.persistence.JpaCategoryRepository;
import com.bibbidi.wedding.catalog.persistence.JpaStepEntity;
import com.bibbidi.wedding.catalog.persistence.JpaStepRepository;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemRepository;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistRepository;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.restdocs.RestDocumentationContextProvider;
import org.springframework.restdocs.RestDocumentationExtension;
import org.springframework.restdocs.payload.FieldDescriptor;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@ExtendWith(RestDocumentationExtension.class)
class CatalogControllerIntegrationTest {

    private static final Long USER_ID = 7L;

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private JpaCategoryRepository jpaCategoryRepository;

    @Autowired
    private JpaStepRepository jpaStepRepository;

    @Autowired
    private JpaCatalogItemRepository jpaCatalogItemRepository;

    @Autowired
    private JpaChecklistRepository jpaChecklistRepository;

    @Autowired
    private JpaChecklistItemRepository jpaChecklistItemRepository;

    private MockMvc mockMvc;

    private Long categoryId;
    private Long stepId;
    private Long catalogItemId;

    @BeforeEach
    void setUp(RestDocumentationContextProvider restDocumentation) {
        mockMvc = webAppContextSetup(context)
                .apply(documentationConfiguration(restDocumentation))
                .build();

        JpaCategoryEntity category = jpaCategoryRepository.save(new JpaCategoryEntity(null, "웨딩홀", 1));
        JpaStepEntity step = jpaStepRepository.save(new JpaStepEntity(
                null, category.id(), "웨딩홀 계약", "웨딩홀을 결정하고 계약한다.", 1
        ));
        JpaCatalogItemEntity catalogItem = jpaCatalogItemRepository.save(new JpaCatalogItemEntity(
                null, step.id(), "계약서 확인", null, 1, true
        ));
        JpaChecklistEntity checklist = jpaChecklistRepository.save(new JpaChecklistEntity(null, USER_ID));
        jpaChecklistItemRepository.save(new JpaChecklistItemEntity(
                null, checklist.id(), category.id(), catalogItem.id(), "계약서 확인", ChecklistItemStatus.PREV
        ));

        categoryId = category.id();
        stepId = step.id();
        catalogItemId = catalogItem.id();
    }

    @Test
    @DisplayName("인증된 사용자가 준비 목록 조회에 성공한다")
    void shouldFindCatalogWhenUserIsAuthenticated() throws Exception {
        // when & then
        mockMvc.perform(get("/api/catalog").session(authenticatedSession()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.categories[0].id").value(categoryId))
                .andExpect(jsonPath("$.categories[0].steps[0].id").value(stepId))
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].id").value(catalogItemId))
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].included").value(true))
                .andDo(document(
                        "catalog-find",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Catalog")
                                .summary("준비 목록 조회")
                                .description("전체 준비 목록을 단계별로 조회하고 현재 사용자의 체크리스트 포함 여부를 반환합니다.")
                                .responseSchema(schema("CatalogResponse"))
                                .responseFields(catalogResponseFields())
                                .build())
                ));
    }

    @Test
    @DisplayName("인증되지 않은 사용자의 준비 목록 조회를 거부한다")
    void shouldRejectCatalogWhenUserIsUnauthenticated() throws Exception {
        // when & then
        mockMvc.perform(get("/api/catalog"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201))
                .andExpect(jsonPath("$.message").value("로그인이 필요합니다."))
                .andDo(document(
                        "catalog-find-unauthorized",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Catalog")
                                .summary("인증 없이 준비 목록 조회")
                                .description("인증되지 않은 요청은 거부합니다.")
                                .responseSchema(schema("ErrorResponse"))
                                .responseFields(
                                        fieldWithPath("errorCode").description("오류 코드"),
                                        fieldWithPath("message").description("오류 메시지")
                                )
                                .build())
                ));
    }

    private static MockHttpSession authenticatedSession() {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(AuthSession.USER_ID_ATTRIBUTE, USER_ID);
        return session;
    }

    private static FieldDescriptor[] catalogResponseFields() {
        return new FieldDescriptor[]{
                fieldWithPath("categories").description("준비 영역 목록"),
                fieldWithPath("categories[].id").description("준비 영역 ID"),
                fieldWithPath("categories[].name").description("준비 영역 이름"),
                fieldWithPath("categories[].displayOrder").description("준비 영역 노출 순서"),
                fieldWithPath("categories[].steps").description("준비 단계 목록"),
                fieldWithPath("categories[].steps[].id").description("준비 단계 ID"),
                fieldWithPath("categories[].steps[].name").description("준비 단계 이름"),
                fieldWithPath("categories[].steps[].description").description("준비 단계 설명").optional(),
                fieldWithPath("categories[].steps[].displayOrder").description("준비 단계 노출 순서"),
                fieldWithPath("categories[].steps[].items").description("준비 항목 목록"),
                fieldWithPath("categories[].steps[].items[].id").description("준비 항목 ID"),
                fieldWithPath("categories[].steps[].items[].title").description("준비 항목 제목"),
                fieldWithPath("categories[].steps[].items[].displayOrder").description("준비 항목 노출 순서"),
                fieldWithPath("categories[].steps[].items[].essential").description("필수 준비 항목 여부"),
                fieldWithPath("categories[].steps[].items[].included").description("현재 사용자의 체크리스트 포함 여부")
        };
    }
}
