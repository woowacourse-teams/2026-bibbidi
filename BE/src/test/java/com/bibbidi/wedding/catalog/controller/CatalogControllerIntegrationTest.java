package com.bibbidi.wedding.catalog.controller;

import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.restdocs.headers.HeaderDocumentation.headerWithName;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.documentationConfiguration;
import static org.springframework.restdocs.operation.preprocess.Preprocessors.modifyHeaders;
import static org.springframework.restdocs.operation.preprocess.Preprocessors.preprocessRequest;
import static org.springframework.restdocs.payload.PayloadDocumentation.fieldWithPath;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

import com.bibbidi.wedding.auth.session.AuthSession;
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
import org.springframework.restdocs.payload.FieldDescriptor;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Sql("/catalog-fixture.sql")
@ExtendWith(RestDocumentationExtension.class)
class CatalogControllerIntegrationTest {

    private static final Long USER_ID = 7L;
    private static final long WEDDING_HALL_CATEGORY_ID = 2L;
    private static final long HONEYMOON_CATEGORY_ID = 1L;
    private static final long CONTRACT_STEP_ID = 11L;
    private static final long CONSULTING_STEP_ID = 10L;
    private static final long INCLUDED_ITEM_ID = 100L;
    private static final long EXCLUDED_ITEM_ID = 101L;
    private static final String CATALOG_FIND_SUMMARY = "준비 목록 조회";
    private static final String CATALOG_FIND_DESCRIPTION =
            "로그인으로 발급받은 JSESSIONID Session Cookie가 필요합니다. "
                    + "준비 영역, 단계, 항목을 각각 displayOrder 오름차순으로 반환합니다. "
                    + "각 항목의 included는 현재 사용자의 체크리스트 포함 여부를 나타냅니다.";
    private static final String CATALOG_PUBLIC_SUMMARY = "준비 목록 공개 조회";
    private static final String CATALOG_PUBLIC_DESCRIPTION =
            "로그인 없이 조회할 수 있습니다. "
                    + "준비 영역, 단계, 항목을 각각 displayOrder 오름차순으로 반환합니다. "
                    + "체크리스트 포함 여부(included)는 내려주지 않습니다.";
    private static final String SESSION_COOKIE_DESCRIPTION =
            "로그인 API가 발급한 인증 Session Cookie. 형식: JSESSIONID=<session-id>";
    private static final String DOCUMENTED_SESSION_COOKIE = "JSESSIONID=<session-id>";

    @Autowired
    private WebApplicationContext context;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp(RestDocumentationContextProvider restDocumentation) {
        mockMvc = webAppContextSetup(context)
                .apply(documentationConfiguration(restDocumentation))
                .build();
    }

    @Test
    @DisplayName("인증된 사용자가 준비 목록 조회에 성공한다")
    void shouldFindCatalogWhenUserIsAuthenticated() throws Exception {
        // given
        MockHttpSession session = authenticatedSession();

        // when & then
        mockMvc.perform(get("/api/catalog")
                        .session(session)
                        .header(HttpHeaders.COOKIE, "JSESSIONID=" + session.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.categories.length()").value(2))
                .andExpect(jsonPath("$.categories[0].id").value(WEDDING_HALL_CATEGORY_ID))
                .andExpect(jsonPath("$.categories[0].name").value("웨딩홀"))
                .andExpect(jsonPath("$.categories[0].displayOrder").value(1))
                .andExpect(jsonPath("$.categories[0].steps.length()").value(2))
                .andExpect(jsonPath("$.categories[0].steps[0].id").value(CONTRACT_STEP_ID))
                .andExpect(jsonPath("$.categories[0].steps[0].name").value("웨딩홀 계약"))
                .andExpect(jsonPath("$.categories[0].steps[0].description")
                        .value("웨딩홀을 결정하고 계약한다."))
                .andExpect(jsonPath("$.categories[0].steps[0].displayOrder").value(1))
                .andExpect(jsonPath("$.categories[0].steps[0].items.length()").value(2))
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].id").value(EXCLUDED_ITEM_ID))
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].title").value("견적 비교"))
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].displayOrder").value(1))
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].essential").value(false))
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].included").value(false))
                .andExpect(jsonPath("$.categories[0].steps[0].items[1].id").value(INCLUDED_ITEM_ID))
                .andExpect(jsonPath("$.categories[0].steps[0].items[1].title").value("계약서 확인"))
                .andExpect(jsonPath("$.categories[0].steps[0].items[1].displayOrder").value(2))
                .andExpect(jsonPath("$.categories[0].steps[0].items[1].essential").value(true))
                .andExpect(jsonPath("$.categories[0].steps[0].items[1].included").value(true))
                .andExpect(jsonPath("$.categories[0].steps[1].id").value(CONSULTING_STEP_ID))
                .andExpect(jsonPath("$.categories[0].steps[1].name").value("웨딩홀 상담"))
                .andExpect(jsonPath("$.categories[0].steps[1].description").value(nullValue()))
                .andExpect(jsonPath("$.categories[0].steps[1].displayOrder").value(2))
                .andExpect(jsonPath("$.categories[0].steps[1].items").isEmpty())
                .andExpect(jsonPath("$.categories[1].id").value(HONEYMOON_CATEGORY_ID))
                .andExpect(jsonPath("$.categories[1].name").value("신혼여행"))
                .andExpect(jsonPath("$.categories[1].displayOrder").value(2))
                .andExpect(jsonPath("$.categories[1].steps").isEmpty())
                .andDo(document(
                        "catalog-find",
                        preprocessRequest(modifyHeaders().set(
                                HttpHeaders.COOKIE,
                                DOCUMENTED_SESSION_COOKIE
                        )),
                        resource(ResourceSnippetParameters.builder()
                                .tag("Catalog")
                                .summary(CATALOG_FIND_SUMMARY)
                                .description(CATALOG_FIND_DESCRIPTION)
                                .responseSchema(schema("CatalogResponse"))
                                .requestHeaders(
                                        headerWithName(HttpHeaders.COOKIE)
                                                .description(SESSION_COOKIE_DESCRIPTION)
                                )
                                .responseFields(catalogResponseFields())
                                .build())
                ));
    }

    @Test
    @DisplayName("인증되지 않은 사용자의 준비 목록 조회를 거부한다")
    void shouldRejectCatalogWhenUserIsUnauthenticated() throws Exception {
        // when & then
        mockMvc.perform(get("/api/catalog")
                        .header(HttpHeaders.COOKIE, "JSESSIONID=expired-session-id"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201))
                .andExpect(jsonPath("$.message").value("로그인이 필요합니다."))
                .andDo(document(
                        "catalog-find-unauthorized",
                        preprocessRequest(modifyHeaders().set(
                                HttpHeaders.COOKIE,
                                DOCUMENTED_SESSION_COOKIE
                        )),
                        resource(ResourceSnippetParameters.builder()
                                .tag("Catalog")
                                .summary(CATALOG_FIND_SUMMARY)
                                .description(CATALOG_FIND_DESCRIPTION)
                                .responseSchema(schema("ErrorResponse"))
                                .requestHeaders(
                                        headerWithName(HttpHeaders.COOKIE)
                                                .description(SESSION_COOKIE_DESCRIPTION)
                                )
                                .responseFields(
                                        fieldWithPath("errorCode")
                                                .description("클라이언트가 오류를 구분하는 코드. 인증 필요 오류는 201"),
                                        fieldWithPath("message")
                                                .description("사용자에게 안내할 인증 오류 메시지")
                                )
                                .build())
                ));
    }

    @Test
    @DisplayName("로그인하지 않은 사용자가 준비 목록 공개 조회에 성공한다")
    void shouldFindPublicCatalogWithoutAuthentication() throws Exception {
        // when & then
        mockMvc.perform(get("/api/catalog/public"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.categories.length()").value(2))
                .andExpect(jsonPath("$.categories[0].id").value(WEDDING_HALL_CATEGORY_ID))
                .andExpect(jsonPath("$.categories[0].name").value("웨딩홀"))
                .andExpect(jsonPath("$.categories[0].displayOrder").value(1))
                .andExpect(jsonPath("$.categories[0].steps.length()").value(2))
                .andExpect(jsonPath("$.categories[0].steps[0].id").value(CONTRACT_STEP_ID))
                .andExpect(jsonPath("$.categories[0].steps[0].name").value("웨딩홀 계약"))
                .andExpect(jsonPath("$.categories[0].steps[0].description")
                        .value("웨딩홀을 결정하고 계약한다."))
                .andExpect(jsonPath("$.categories[0].steps[0].displayOrder").value(1))
                .andExpect(jsonPath("$.categories[0].steps[0].items.length()").value(2))
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].id").value(EXCLUDED_ITEM_ID))
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].title").value("견적 비교"))
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].displayOrder").value(1))
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].essential").value(false))
                .andExpect(jsonPath("$.categories[0].steps[0].items[1].id").value(INCLUDED_ITEM_ID))
                .andExpect(jsonPath("$.categories[0].steps[0].items[1].title").value("계약서 확인"))
                .andExpect(jsonPath("$.categories[0].steps[1].id").value(CONSULTING_STEP_ID))
                .andExpect(jsonPath("$.categories[0].steps[1].name").value("웨딩홀 상담"))
                .andExpect(jsonPath("$.categories[0].steps[1].description").value(nullValue()))
                .andExpect(jsonPath("$.categories[0].steps[1].items").isEmpty())
                .andExpect(jsonPath("$.categories[1].id").value(HONEYMOON_CATEGORY_ID))
                .andExpect(jsonPath("$.categories[1].name").value("신혼여행"))
                .andExpect(jsonPath("$.categories[1].displayOrder").value(2))
                .andExpect(jsonPath("$.categories[1].steps").isEmpty())
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].included").doesNotExist())
                .andExpect(jsonPath("$.categories[0].steps[0].items[1].included").doesNotExist())
                .andDo(document(
                        "catalog-public",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Catalog")
                                .summary(CATALOG_PUBLIC_SUMMARY)
                                .description(CATALOG_PUBLIC_DESCRIPTION)
                                .responseSchema(schema("PublicCatalogResponse"))
                                .responseFields(publicCatalogResponseFields())
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
                fieldWithPath("categories")
                        .description("displayOrder 오름차순으로 정렬된 준비 영역 목록. 없으면 빈 배열"),
                fieldWithPath("categories[].id").description("카탈로그 준비 영역 ID"),
                fieldWithPath("categories[].name").description("준비 영역 이름"),
                fieldWithPath("categories[].displayOrder")
                        .description("전체 준비 영역에서의 노출 순서. 값이 작을수록 먼저 노출"),
                fieldWithPath("categories[].steps")
                        .description("현재 준비 영역의 단계 목록. displayOrder 오름차순이며 없으면 빈 배열"),
                fieldWithPath("categories[].steps[].id").description("카탈로그 준비 단계 ID"),
                fieldWithPath("categories[].steps[].name").description("준비 단계 이름"),
                fieldWithPath("categories[].steps[].description")
                        .description("준비 단계 설명. 설명이 없으면 null")
                        .optional(),
                fieldWithPath("categories[].steps[].displayOrder")
                        .description("현재 준비 영역 안에서의 단계 노출 순서. 값이 작을수록 먼저 노출"),
                fieldWithPath("categories[].steps[].items")
                        .description("현재 단계의 준비 항목 목록. displayOrder 오름차순이며 없으면 빈 배열"),
                fieldWithPath("categories[].steps[].items[].id")
                        .description("카탈로그 준비 항목 ID. 사용자 체크리스트 항목 ID와는 다른 값"),
                fieldWithPath("categories[].steps[].items[].title").description("준비 항목 제목"),
                fieldWithPath("categories[].steps[].items[].displayOrder")
                        .description("현재 준비 단계 안에서의 항목 노출 순서. 값이 작을수록 먼저 노출"),
                fieldWithPath("categories[].steps[].items[].essential")
                        .description("필수 준비 항목이면 true, 선택 준비 항목이면 false"),
                fieldWithPath("categories[].steps[].items[].included")
                        .description("현재 사용자의 체크리스트에 같은 카탈로그 항목이 있으면 true, 없으면 false")
        };
    }

    private static FieldDescriptor[] publicCatalogResponseFields() {
        return new FieldDescriptor[]{
                fieldWithPath("categories")
                        .description("displayOrder 오름차순으로 정렬된 준비 영역 목록. 없으면 빈 배열"),
                fieldWithPath("categories[].id").description("카탈로그 준비 영역 ID"),
                fieldWithPath("categories[].name").description("준비 영역 이름"),
                fieldWithPath("categories[].displayOrder")
                        .description("전체 준비 영역에서의 노출 순서. 값이 작을수록 먼저 노출"),
                fieldWithPath("categories[].steps")
                        .description("현재 준비 영역의 단계 목록. displayOrder 오름차순이며 없으면 빈 배열"),
                fieldWithPath("categories[].steps[].id").description("카탈로그 준비 단계 ID"),
                fieldWithPath("categories[].steps[].name").description("준비 단계 이름"),
                fieldWithPath("categories[].steps[].description")
                        .description("준비 단계 설명. 설명이 없으면 null")
                        .optional(),
                fieldWithPath("categories[].steps[].displayOrder")
                        .description("현재 준비 영역 안에서의 단계 노출 순서. 값이 작을수록 먼저 노출"),
                fieldWithPath("categories[].steps[].items")
                        .description("현재 단계의 준비 항목 목록. displayOrder 오름차순이며 없으면 빈 배열"),
                fieldWithPath("categories[].steps[].items[].id")
                        .description("카탈로그 준비 항목 ID. 사용자 체크리스트 항목 ID와는 다른 값"),
                fieldWithPath("categories[].steps[].items[].title").description("준비 항목 제목"),
                fieldWithPath("categories[].steps[].items[].displayOrder")
                        .description("현재 준비 단계 안에서의 항목 노출 순서. 값이 작을수록 먼저 노출"),
                fieldWithPath("categories[].steps[].items[].essential")
                        .description("필수 준비 항목이면 true, 선택 준비 항목이면 false")
        };
    }
}
