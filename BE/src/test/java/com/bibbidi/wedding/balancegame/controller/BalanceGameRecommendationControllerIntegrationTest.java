package com.bibbidi.wedding.balancegame.controller;

import static com.bibbidi.wedding.support.AuthenticationTestSupport.DOCUMENTED_AUTHORIZATION_HEADER;
import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.headerWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.hamcrest.Matchers.contains;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.restdocs.payload.PayloadDocumentation.fieldWithPath;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.auth.token.BibbidiTokenIssuer;
import com.bibbidi.wedding.balancegame.controller.dto.BalanceGameRecommendationRequest;
import com.bibbidi.wedding.balancegame.controller.dto.BalanceGameRecommendationRequest.Answer;
import com.bibbidi.wedding.common.domain.UserStatus;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.support.AuthenticationTestSupport;
import com.bibbidi.wedding.support.BibbidiIntegrationTest;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import java.util.stream.LongStream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.ObjectMapper;

class BalanceGameRecommendationControllerIntegrationTest extends BibbidiIntegrationTest {

    private static final String PATH = "/api/balance-game/recommendations";

    @Autowired
    private ObjectMapper mapper;

    @Autowired
    private BibbidiTokenIssuer tokenIssuer;

    @Test
    @Sql("/load_catalog.sql")
    @DisplayName("JSON 기본·추가 항목을 조합해 실제 카탈로그 데이터로 응답하고 REST Docs를 생성한다")
    void shouldRecommendCatalogItemsByRules() throws Exception {
        perform(validRequest())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$.items.length()").value(66))
                .andExpect(jsonPath("$.items[0].catalogItemId").value(139))
                .andExpect(jsonPath("$.items[63:].catalogItemId", contains(22, 161, 162)))
                .andExpect(jsonPath("$.items[0].length()").value(5))
                .andExpect(jsonPath("$.items[0].title").value("총예산 수립"))
                .andExpect(jsonPath("$.items[1].title").value("예비비 편성"))
                .andExpect(jsonPath("$.items[0].categoryName").value("기타"))
                .andExpect(jsonPath("$.items[0].phase").value(1))
                .andExpect(jsonPath("$.items[0].stepName").value("결혼 준비 기본 계획"))
                .andDo(document("balance-game-recommendations-create",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Balance Game")
                                .summary("밸런스게임 답변 기반 준비항목 추천")
                                .description("로그인과 약관 동의가 필요합니다. 모든 문항에 한 번씩 답변해야 하며 "
                                        + "UNKNOWN도 유효한 답변입니다. 기본 항목 뒤에 문항 순서로 추가하며 중복은 제거합니다. "
                                        + "사용자가 확정한 공통 기본 항목 63개에 답변별 항목을 추가합니다.")
                                .requestSchema(schema("BalanceGameRecommendationRequest"))
                                .responseSchema(schema("BalanceGameRecommendationResponse"))
                                .requestHeaders(headerWithName(AUTHORIZATION)
                                        .description(DOCUMENTED_AUTHORIZATION_HEADER))
                                .requestFields(
                                        fieldWithPath("answers").description("전체 문항에 대한 답변 목록"),
                                        fieldWithPath("answers[].questionId").description("문항 ID. 중복·누락 불가"),
                                        fieldWithPath("answers[].optionId").description("해당 문항의 선택지 ID. UNKNOWN 허용"))
                                .responseFields(
                                        fieldWithPath("items").description("추천 순서의 실제 카탈로그 항목"),
                                        fieldWithPath("items[].catalogItemId").description("카탈로그 항목 ID"),
                                        fieldWithPath("items[].title").description("카탈로그 항목명"),
                                        fieldWithPath("items[].categoryName").description("카탈로그 카테고리명"),
                                        fieldWithPath("items[].phase").description("카탈로그 단계 순서"),
                                        fieldWithPath("items[].stepName").description("카탈로그 단계명"))
                                .build())));
    }

    @Test
    @DisplayName("인증되지 않은 사용자는 추천할 수 없다")
    void shouldRequireAuthentication() throws Exception {
        mockMvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(validRequest())))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(ClientError.AUTHENTICATION_REQUIRED.errorCode()));
    }

    @Test
    @DisplayName("약관 동의 전 사용자는 추천할 수 없다")
    void shouldRequireTermsAgreement() throws Exception {
        mockMvc.perform(post(PATH).header(AUTHORIZATION, bearerToken(UserStatus.PENDING))
                        .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(validRequest())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value(ClientError.TERMS_AGREEMENT_REQUIRED.errorCode()));
    }

    private ResultActions perform(BalanceGameRecommendationRequest request) throws Exception {
        return mockMvc.perform(post(PATH).header(AUTHORIZATION, bearerToken(UserStatus.ACTIVE))
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(request)));
    }

    private static BalanceGameRecommendationRequest validRequest() {
        return new BalanceGameRecommendationRequest(LongStream.rangeClosed(1, 10)
                .mapToObj(id -> new Answer(id, id == 2 ? "UNKNOWN" : "A")).toList());
    }

    private String bearerToken(UserStatus status) {
        return AuthenticationTestSupport.bearerTokenOf(tokenIssuer, 1L, "balance", status);
    }
}
