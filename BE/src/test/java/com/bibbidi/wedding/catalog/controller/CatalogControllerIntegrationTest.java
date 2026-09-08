package com.bibbidi.wedding.catalog.controller;

import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.restdocs.payload.PayloadDocumentation.fieldWithPath;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.support.BibbidiIntegrationTest;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.restdocs.payload.FieldDescriptor;
import org.springframework.test.context.jdbc.Sql;

@Sql("/catalog-fixture.sql")
class CatalogControllerIntegrationTest extends BibbidiIntegrationTest {

    private static final long WEDDING_HALL_CATEGORY_ID = 2L;
    private static final long HONEYMOON_CATEGORY_ID = 1L;
    private static final long CONTRACT_STEP_ID = 11L;
    private static final long CONSULTING_STEP_ID = 10L;
    private static final long CONTRACT_ITEM_ID = 100L;
    private static final long ESTIMATE_ITEM_ID = 101L;
    private static final String CATALOG_FIND_SUMMARY = "준비 목록 조회";
    private static final String CATALOG_FIND_DESCRIPTION =
            "로그인 없이 조회할 수 있습니다. "
                    + "준비 영역, 단계, 항목을 각각 displayOrder 오름차순으로 반환합니다.";

    @Test
    @DisplayName("준비 목록 조회에 성공한다")
    void shouldFindCatalog() throws Exception {
        // when & then
        mockMvc.perform(get("/api/catalog"))
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
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].id").value(ESTIMATE_ITEM_ID))
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].title").value("견적 비교"))
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].displayOrder").value(1))
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].essential").value(false))
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].included").doesNotExist())
                .andExpect(jsonPath("$.categories[0].steps[0].items[1].id").value(CONTRACT_ITEM_ID))
                .andExpect(jsonPath("$.categories[0].steps[0].items[1].title").value("계약서 확인"))
                .andExpect(jsonPath("$.categories[0].steps[0].items[1].displayOrder").value(2))
                .andExpect(jsonPath("$.categories[0].steps[0].items[1].essential").value(true))
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
                                resource(ResourceSnippetParameters.builder()
                                        .tag("Catalog")
                                        .summary(CATALOG_FIND_SUMMARY)
                                        .description(CATALOG_FIND_DESCRIPTION)
                                        .responseSchema(schema("CatalogResponse"))
                                        .responseFields(catalogResponseFields())
                                        .build()
                                )
                        )
                );
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
                fieldWithPath("categories[].steps[].iconUrl")
                        .description("준비 단계를 대표하는 아이콘 이미지 URL. 아이콘이 없으면 null")
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
