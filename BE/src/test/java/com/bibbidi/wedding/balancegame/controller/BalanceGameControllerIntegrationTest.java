package com.bibbidi.wedding.balancegame.controller;

import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.hamcrest.Matchers.contains;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.restdocs.payload.PayloadDocumentation.fieldWithPath;
import static org.springframework.restdocs.payload.PayloadDocumentation.subsectionWithPath;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.balancegame.controller.dto.BalanceGameResultRequest;
import com.bibbidi.wedding.balancegame.domain.WeddingType;
import com.bibbidi.wedding.balancegame.service.port.WeddingTypeClassifierPort;
import com.bibbidi.wedding.support.BibbidiIntegrationTest;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import tools.jackson.databind.ObjectMapper;

class BalanceGameControllerIntegrationTest extends BibbidiIntegrationTest {

    private static final String QUESTIONS_PATH = "/api/balance-game/questions";
    private static final String RESULTS_PATH = "/api/balance-game/results";

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private WeddingTypeClassifierPort classifierPort;

    @Test
    @DisplayName("로그인하지 않아도 문항과 두 선택지 문구를 조회한다")
    void shouldFindQuestionsWithoutLogin() throws Exception {
        mockMvc.perform(get(QUESTIONS_PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questions[*].id", contains("Q1", "Q2")))
                .andExpect(jsonPath("$.questions[0].text").value("기념일 데이트, 더 끌리는 쪽은?"))
                .andExpect(jsonPath("$.questions[0].options[*].id", contains("A", "B")))
                .andExpect(jsonPath("$.questions[0].options[0].text").value("동네 단골집에서 편하게"))
                .andExpect(jsonPath("$.questions[0].options[1].text").value("한 달 전에 예약한 파인다이닝"))
                .andDo(document("balance-game-questions-find",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Balance Game")
                                .summary("밸런스게임 문항 조회")
                                .description("로그인 없이 호출합니다. 문항은 콘텐츠 파일에 적힌 순서대로 반환합니다.")
                                .responseSchema(schema("BalanceGameQuestionsResponse"))
                                .responseFields(
                                        fieldWithPath("questions").description("문항 목록"),
                                        fieldWithPath("questions[].id").description("문항 ID. 결과 요청 answers의 키로 쓴다"),
                                        fieldWithPath("questions[].text").description("질문 문구"),
                                        fieldWithPath("questions[].options").description("선택지 목록"),
                                        fieldWithPath("questions[].options[].id")
                                                .description("선택지 ID. 결과 요청 answers의 값으로 쓴다"),
                                        fieldWithPath("questions[].options[].text").description("선택지 문구"))
                                .build())));
    }

    @Test
    @DisplayName("로그인하지 않아도 답변을 보내면 판정된 유형 카드를 받는다")
    void shouldJudgeTypeWithoutLogin() throws Exception {
        given(classifierPort.classify(any(), any()))
                .willAnswer(invocation -> invocation.<List<WeddingType>>getArgument(1).getLast());
        BalanceGameResultRequest request = new BalanceGameResultRequest(Map.of("Q1", "B"));

        mockMvc.perform(post(RESULTS_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("LUXURY"))
                .andExpect(jsonPath("$.name").value("한 번뿐인 날 화려파"))
                .andExpect(jsonPath("$.catalogItemIds", contains(1, 2, 19)))
                .andDo(document("balance-game-results-judge",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Balance Game")
                                .summary("밸런스게임 결과 판정")
                                .description("로그인 없이 호출합니다. 결과는 저장하지 않습니다. "
                                        + "AI가 정해진 유형 중 하나를 고르며, AI 호출 한도를 넘으면 503을 반환합니다.")
                                .requestSchema(schema("BalanceGameResultRequest"))
                                .responseSchema(schema("BalanceGameResultResponse"))
                                .requestFields(
                                        subsectionWithPath("answers")
                                                .description("문항 ID별로 고른 선택지 ID. 건너뛴 문항은 넣지 않는다"))
                                .responseFields(
                                        fieldWithPath("id").description("유형 ID"),
                                        fieldWithPath("name").description("유형 이름"),
                                        fieldWithPath("summary").description("카드 설명 문구"),
                                        fieldWithPath("imageUrl").description("유형 이미지 URL"),
                                        fieldWithPath("catalogItemIds")
                                                .description("로그인 후 체크리스트에 담을 준비 항목 ID. "
                                                        + "POST /api/checklists/me/catalog-items 요청에 그대로 쓴다"))
                                .build())));
    }
}
