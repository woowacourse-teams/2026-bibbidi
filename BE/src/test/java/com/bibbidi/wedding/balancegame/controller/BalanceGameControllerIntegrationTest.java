package com.bibbidi.wedding.balancegame.controller;

import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.hamcrest.Matchers.contains;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.springframework.restdocs.payload.PayloadDocumentation.fieldWithPath;
import static org.springframework.restdocs.payload.PayloadDocumentation.subsectionWithPath;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.balancegame.client.BalanceGameAiClient;
import com.bibbidi.wedding.balancegame.controller.dto.BalanceGameResultRequest;
import com.bibbidi.wedding.balancegame.domain.Answer;
import com.bibbidi.wedding.balancegame.domain.WeddingType;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.support.BibbidiIntegrationTest;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.restdocs.payload.FieldDescriptor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.ObjectMapper;

class BalanceGameControllerIntegrationTest extends BibbidiIntegrationTest {

    private static final String QUESTIONS_PATH = "/api/balance-game/questions";
    private static final String RESULTS_PATH = "/api/balance-game/results";

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private BalanceGameAiClient aiClient;

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
        given(aiClient.classify(any(), any()))
                .willAnswer(invocation -> invocation.<List<WeddingType>>getArgument(1).getLast());

        judge(Map.of("Q1", "B"))
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

    @Test
    @DisplayName("건너뛴 문항과 현재 없는 문항은 빼고, 답한 문항만 전체 후보 유형과 함께 판정에 넘긴다")
    void shouldClassifyOnlyAnsweredCurrentQuestions() throws Exception {
        AtomicReference<List<Answer>> sentAnswers = new AtomicReference<>();
        AtomicReference<List<WeddingType>> sentCandidates = new AtomicReference<>();
        given(aiClient.classify(any(), any())).willAnswer(invocation -> {
            sentAnswers.set(invocation.getArgument(0));
            sentCandidates.set(invocation.getArgument(1));
            return sentCandidates.get().getFirst();
        });

        judge(Map.of("Q2", "A", "REMOVED", "B"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("PRACTICAL"));

        assertThat(sentAnswers.get())
                .extracting(Answer::questionText, Answer::selectedText)
                .containsExactly(tuple("여행 숙소를 고른다면?", "깔끔하고 가성비 좋은 숙소"));
        assertThat(sentCandidates.get())
                .extracting(WeddingType::id)
                .containsExactly("PRACTICAL", "LUXURY");
    }

    @Test
    @DisplayName("답변이 하나도 없으면 AI를 부르지 않고 거절한다")
    void shouldRejectEmptyAnswers() throws Exception {
        judge(Map.of())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(ClientError.INVALID_REQUEST.errorCode()))
                .andExpect(jsonPath("$.errors[0].field").value("answers"))
                .andExpect(jsonPath("$.errors[0].message").value("하나 이상의 문항에 답해야 합니다."))
                .andDo(document("balance-game-results-judge-empty-answers",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Balance Game")
                                .summary("답변 없이 밸런스게임 결과 판정")
                                .description("answers가 비어 있으면 AI를 부르지 않고 400으로 거절합니다.")
                                .responseSchema(schema("ValidationErrorResponse"))
                                .responseFields(validationResponseFields())
                                .build())));
        then(aiClient).shouldHaveNoInteractions();
    }

    @Test
    @DisplayName("선택지 ID가 비어 있으면 AI를 부르지 않고 거절한다")
    void shouldRejectBlankOptionId() throws Exception {
        judge(Map.of("Q1", " "))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(ClientError.INVALID_REQUEST.errorCode()))
                .andExpect(jsonPath("$.errors[0].message").value("선택지 ID는 비어 있을 수 없습니다."));
        then(aiClient).shouldHaveNoInteractions();
    }

    @Test
    @DisplayName("문항에 없는 선택지를 고르면 AI를 부르지 않고 거절한다")
    void shouldRejectUnknownOption() throws Exception {
        judge(Map.of("Q1", "C"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(ClientError.INVALID_REQUEST.errorCode()))
                .andDo(document("balance-game-results-judge-unknown-option",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Balance Game")
                                .summary("없는 선택지로 밸런스게임 결과 판정")
                                .description("문항에 없는 선택지 ID를 보내면 AI를 부르지 않고 400으로 거절합니다.")
                                .responseSchema(schema("ErrorResponse"))
                                .responseFields(errorResponseFields())
                                .build())));
        then(aiClient).shouldHaveNoInteractions();
    }

    @Test
    @DisplayName("현재 문항에 대한 답이 하나도 없으면 AI를 부르지 않고 거절한다")
    void shouldRejectWhenNoCurrentQuestionIsAnswered() throws Exception {
        judge(Map.of("REMOVED", "A"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(ClientError.INVALID_REQUEST.errorCode()))
                .andDo(document("balance-game-results-judge-no-current-answer",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Balance Game")
                                .summary("현재 문항 답 없이 밸런스게임 결과 판정")
                                .description("문항 파일이 바뀌어 보낸 문항 ID가 현재 문항에 하나도 없으면 400으로 거절합니다. "
                                        + "일부만 없으면 그 문항만 빼고 판정합니다.")
                                .responseSchema(schema("ErrorResponse"))
                                .responseFields(errorResponseFields())
                                .build())));
        then(aiClient).shouldHaveNoInteractions();
    }

    @Test
    @DisplayName("AI 호출 한도를 넘으면 잠시 후 다시 시도하라는 503 오류를 받는다")
    void shouldRespondServiceUnavailableWhenAiCapacityExceeded() throws Exception {
        given(aiClient.classify(any(), any()))
                .willThrow(new BusinessException(ClientError.AI_CAPACITY_EXCEEDED, "밸런스게임 AI 호출 한도를 넘었습니다."));

        judge(Map.of("Q1", "B"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.errorCode").value(ClientError.AI_CAPACITY_EXCEEDED.errorCode()))
                .andExpect(jsonPath("$.message").value(ClientError.AI_CAPACITY_EXCEEDED.message()))
                .andDo(document("balance-game-results-judge-ai-capacity-exceeded",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Balance Game")
                                .summary("AI 호출 한도 초과 시 밸런스게임 결과 판정")
                                .description("AI 호출 한도를 넘으면 503으로 응답합니다. 잠시 후 같은 요청을 다시 보내면 됩니다.")
                                .responseSchema(schema("ErrorResponse"))
                                .responseFields(errorResponseFields())
                                .build())));
    }

    private ResultActions judge(Map<String, String> answers) throws Exception {
        return mockMvc.perform(post(RESULTS_PATH)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new BalanceGameResultRequest(answers))));
    }

    private static FieldDescriptor[] errorResponseFields() {
        return new FieldDescriptor[]{
                fieldWithPath("errorCode").description("오류 코드"),
                fieldWithPath("message").description("오류 메시지")
        };
    }

    private static FieldDescriptor[] validationResponseFields() {
        return new FieldDescriptor[]{
                fieldWithPath("errorCode").description("오류 코드"),
                fieldWithPath("message").description("오류 메시지"),
                fieldWithPath("errors").description("필드별 검증 오류 목록"),
                fieldWithPath("errors[].field").description("검증에 실패한 필드"),
                fieldWithPath("errors[].message").description("검증 오류 메시지")
        };
    }
}
