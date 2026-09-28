package com.bibbidi.wedding.terms.controller;

import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.support.BibbidiIntegrationTest;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.restdocs.payload.PayloadDocumentation;
import org.springframework.test.context.jdbc.Sql;

@Sql("/terms-fixture.sql")
class TermsControllerIntegrationTest extends BibbidiIntegrationTest {

    @Test
    @DisplayName("가입 전에도 약관을 볼 수 있다")
    void shouldFindTermsWithoutLogin() throws Exception {
        mockMvc.perform(get("/api/terms"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].code").isNotEmpty())
                .andDo(document(
                        "terms-find-all",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Terms")
                                .summary("약관 조회")
                                .description("가입 화면에서 보여 줄 약관을 모두 내려 줍니다. 로그인 없이 부를 수 있습니다.")
                                .responseSchema(schema("TermsResponse"))
                                .responseFields(
                                        PayloadDocumentation.fieldWithPath("[].id")
                                                .description("동의할 때 돌려보내는 식별자"),
                                        PayloadDocumentation.fieldWithPath("[].code")
                                                .description("약관 종류"),
                                        PayloadDocumentation.fieldWithPath("[].version")
                                                .description("문구의 판"),
                                        PayloadDocumentation.fieldWithPath("[].title")
                                                .description("약관 제목"),
                                        PayloadDocumentation.fieldWithPath("[].content")
                                                .description("약관 전문"),
                                        PayloadDocumentation.fieldWithPath("[].required")
                                                .description("동의해야만 가입이 끝나는지"))
                                .build())));
    }
}
