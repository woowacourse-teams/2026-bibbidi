package com.bibbidi.wedding.balancegame.controller;

import static com.bibbidi.wedding.support.AuthenticationTestSupport.DOCUMENTED_AUTHORIZATION_HEADER;
import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.headerWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
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
import java.util.List;
import java.util.stream.LongStream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.bedrock.converse.BedrockChatOptions;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class BalanceGameRecommendationControllerIntegrationTest extends BibbidiIntegrationTest {

    private static final String PATH = "/api/balance-game/recommendations";

    @Autowired
    private ObjectMapper mapper;

    @Autowired
    private BibbidiTokenIssuer tokenIssuer;

    @MockitoBean
    private ChatModel model;

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Sql("/fixtures/catalog-fixture.sql")
    @Sql(statements = {
            "DELETE FROM catalog_items WHERE id IN (100, 101)",
            "DELETE FROM steps WHERE id IN (10, 11)",
            "DELETE FROM categories WHERE id IN (1, 2)"
    }, executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD)
    @DisplayName("트랜잭션 밖에서 전체 답변과 실제 카탈로그를 AI에 전달하고 추천 항목을 반환한다")
    void shouldRecommendCatalogItemsWithoutTransaction() throws Exception {
        when(model.getOptions()).thenReturn(BedrockChatOptions.builder().model("qwen-default").build());
        when(model.call(any(Prompt.class))).thenAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            Prompt prompt = invocation.getArgument(0);
            JsonNode input = mapper.readTree(prompt.getUserMessage().getText());
            assertThat(input.get("answers").size()).isEqualTo(10);
            assertThat(input.get("catalog").size()).isEqualTo(2);
            return response("{\"recommendedItemIds\":[100,101]}");
        });

        perform(validRequest())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$.items[*].catalogItemId", contains(100, 101)))
                .andExpect(jsonPath("$.items[0].length()").value(5))
                .andExpect(jsonPath("$.items[0].title").value("계약서 확인"))
                .andExpect(jsonPath("$.items[1].title").value("견적 비교"))
                .andExpect(jsonPath("$.items[0].categoryName").value("웨딩홀"))
                .andExpect(jsonPath("$.items[0].phase").value(1))
                .andExpect(jsonPath("$.items[0].stepName").value("웨딩홀 계약"))
                .andDo(document("balance-game-recommendations-create",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Balance Game")
                                .summary("밸런스게임 답변 기반 준비항목 추천")
                                .description("로그인과 약관 동의가 필요합니다. 모든 문항에 한 번씩 답변해야 하며 "
                                        + "UNKNOWN도 유효한 답변입니다. 추천 순서를 유지하고 중복 항목은 제거합니다.")
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
        verify(model).call(any(Prompt.class));
        verify(model, never()).stream(any(Prompt.class));
    }

    @Test
    @DisplayName("인증되지 않은 사용자는 추천할 수 없다")
    void shouldRequireAuthentication() throws Exception {
        mockMvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(validRequest())))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(ClientError.AUTHENTICATION_REQUIRED.errorCode()));
        verify(model, never()).call(any(Prompt.class));
    }

    @Test
    @DisplayName("약관 동의 전 사용자는 추천할 수 없다")
    void shouldRequireTermsAgreement() throws Exception {
        mockMvc.perform(post(PATH).header(AUTHORIZATION, bearerToken(UserStatus.PENDING))
                        .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(validRequest())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value(ClientError.TERMS_AGREEMENT_REQUIRED.errorCode()));
        verify(model, never()).call(any(Prompt.class));
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

    private static ChatResponse response(String content) {
        return new ChatResponse(List.of(new Generation(new AssistantMessage(content))));
    }
}
