package com.bibbidi.wedding.balancegame.controller;

import static com.bibbidi.wedding.support.AuthenticationTestSupport.DOCUMENTED_AUTHORIZATION_HEADER;
import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.headerWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.restdocs.payload.PayloadDocumentation.fieldWithPath;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.auth.token.BibbidiTokenIssuer;
import com.bibbidi.wedding.common.domain.UserStatus;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.support.AuthenticationTestSupport;
import com.bibbidi.wedding.support.BibbidiIntegrationTest;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import jakarta.persistence.EntityManagerFactory;
import java.util.stream.IntStream;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.restdocs.payload.JsonFieldType;

class BalanceGameQuestionControllerIntegrationTest extends BibbidiIntegrationTest {

    private static final String PATH = "/api/balance-game/questions";

    @Autowired
    private BibbidiTokenIssuer tokenIssuer;

    @Test
    @DisplayName("로그인한 사용자는 전체 문항과 선택지를 조회하고 DB를 호출하지 않는다")
    void shouldFindAllQuestionsWithoutDatabaseQueries(@Autowired EntityManagerFactory entityManagerFactory)
            throws Exception {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        boolean statisticsEnabled = statistics.isStatisticsEnabled();
        statistics.setStatisticsEnabled(true);
        long statementCount = statistics.getPrepareStatementCount();
        try {
            mockMvc.perform(get(PATH).header(AUTHORIZATION, bearerToken(UserStatus.ACTIVE)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.questions", hasSize(10)))
                    .andExpect(jsonPath("$.questions[*].id", contains(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)))
                    .andExpect(jsonPath("$.questions[*].order", contains(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)))
                    .andExpect(jsonPath("$.questions[0].question").value("결혼식 날, 어떤 사진을 남기고 싶어?"))
                    .andExpect(jsonPath("$.questions[0].options[*].id", contains("A", "B", "UNKNOWN")))
                    .andExpect(jsonPath("$.questions[0].options[0].text")
                            .value("기본 촬영에 더해, 아이폰으로 생생한 현장 사진도 남길래."))
                    .andExpect(jsonPath("$.questions[0].options[2].text").value("아직 잘 모르겠어"))
                    .andExpect(jsonPath("$.questions[*].options[*].imagePath", hasSize(30)))
                    .andExpect(jsonPath("$.questions[*].options[0].imagePath", contains(imagePaths("a"))))
                    .andExpect(jsonPath("$.questions[*].options[1].imagePath", contains(imagePaths("b"))))
                    .andExpect(jsonPath("$.questions[*].options[2].imagePath", hasSize(10)))
                    .andExpect(jsonPath("$.questions[*].options[2].imagePath", everyItem(nullValue())))
                    .andExpect(jsonPath("$.questions[*].options[*].imageUrl").doesNotExist())
                    .andDo(document("balance-game-questions-find-all",
                            resource(ResourceSnippetParameters.builder()
                                    .tag("Balance Game")
                                    .summary("밸런스게임 전체 문항 조회")
                                    .description("로그인과 약관 동의가 필요합니다. 전체 문항은 order 오름차순으로, "
                                            + "선택지는 문항 파일의 배열 순서로 반환합니다. imagePath는 FE origin 기준의 경로이며, "
                                            + "이미지가 없으면 null입니다.")
                                    .responseSchema(schema("BalanceGameQuestionsResponse"))
                                    .requestHeaders(headerWithName(AUTHORIZATION)
                                            .description(DOCUMENTED_AUTHORIZATION_HEADER))
                                    .responseFields(
                                            fieldWithPath("questions").description("전체 문항 목록. order 오름차순"),
                                            fieldWithPath("questions[].id").description("문항 ID"),
                                            fieldWithPath("questions[].order").description("문항 노출 순서"),
                                            fieldWithPath("questions[].question").description("질문 문구"),
                                            fieldWithPath("questions[].options").description("표시 순서를 유지한 선택지 목록"),
                                            fieldWithPath("questions[].options[].id")
                                                    .description("선택지 ID. UNKNOWN은 아직 모르겠다는 선택"),
                                            fieldWithPath("questions[].options[].text").description("선택지 문구"),
                                            fieldWithPath("questions[].options[].imagePath").type(JsonFieldType.STRING)
                                                    .description("FE origin 기준 이미지 경로. 이미지가 없으면 null")
                                                    .optional())
                                    .build())));
            assertThat(statistics.getPrepareStatementCount()).isEqualTo(statementCount);
        } finally {
            statistics.setStatisticsEnabled(statisticsEnabled);
        }
    }

    @Test
    @DisplayName("로그인하지 않은 요청은 기존 인증 필요 오류를 반환한다")
    void shouldRequireAuthentication() throws Exception {
        mockMvc.perform(get(PATH))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(ClientError.AUTHENTICATION_REQUIRED.errorCode()))
                .andExpect(jsonPath("$.message").value(ClientError.AUTHENTICATION_REQUIRED.message()));
    }

    @Test
    @DisplayName("약관 동의 전 요청은 기존 약관 동의 필요 오류를 반환한다")
    void shouldRequireTermsAgreement() throws Exception {
        mockMvc.perform(get(PATH).header(AUTHORIZATION, bearerToken(UserStatus.PENDING)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value(ClientError.TERMS_AGREEMENT_REQUIRED.errorCode()))
                .andExpect(jsonPath("$.message").value(ClientError.TERMS_AGREEMENT_REQUIRED.message()));
    }

    private String bearerToken(UserStatus status) {
        return AuthenticationTestSupport.bearerTokenOf(tokenIssuer, 1L, "balance", status);
    }

    private static String[] imagePaths(String choice) {
        return IntStream.rangeClosed(1, 10)
                .mapToObj(order -> "/balance-game/q%02d-%s.webp".formatted(order, choice))
                .toArray(String[]::new);
    }
}
