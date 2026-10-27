package com.bibbidi.wedding.balancegame.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import jakarta.validation.Validation;
import jakarta.validation.ValidatorFactory;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import tools.jackson.databind.ObjectMapper;

class BalanceGameRecommendationRuleRepositoryTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final ValidatorFactory VALIDATOR_FACTORY = Validation.buildDefaultValidatorFactory();
    private static final BalanceGameQuestionRepository QUESTIONS = new BalanceGameQuestionRepository(
            MAPPER, VALIDATOR_FACTORY.getValidator(),
            new ClassPathResource("balance-game/questions.json"), "https://images.test");
    private static final BalanceGameRecommendationRuleRepository RULES = fromResource(
            new ClassPathResource("balance-game/recommendation-rules.json"));
    private static final String VALID_JSON = "{\"baseItemIds\":[100,101],\"rules\":["
            + QUESTIONS.findAll().stream().map(question -> """
                    {"questionId":%d,"optionItemIds":{"A":[102],"B":[],"UNKNOWN":[]}}
                    """.formatted(question.id())).collect(Collectors.joining(",")) + "]}";

    @AfterAll
    static void closeValidatorFactory() {
        VALIDATOR_FACTORY.close();
    }

    @Test
    @DisplayName("사용자가 확정한 기본 63개는 표 순서를 유지하고 답변별 추가 항목과 섞이지 않는다")
    void shouldKeepApprovedBaseSeparateFromOptionalItems() {
        assertThat(RULES.findBaseItemIds())
                .containsExactly(139L, 140L, 141L, 142L, 43L,
                        1L, 2L,
                        3L, 4L, 5L, 6L, 10L, 12L, 13L, 14L, 15L, 18L, 28L, 33L, 34L, 35L,
                        19L, 49L, 60L, 61L, 68L, 69L,
                        41L, 47L, 48L, 50L, 52L, 73L, 74L, 75L, 80L, 81L, 82L, 84L, 85L,
                        86L, 87L, 88L, 89L, 90L, 97L, 100L, 101L, 105L, 106L, 107L, 108L, 109L,
                        152L, 153L, 154L,
                        163L, 164L, 165L, 166L, 167L, 168L,
                        169L)
                .doesNotContain(22L, 20L, 70L, 71L, 54L, 55L, 72L, 16L, 17L, 121L, 119L, 57L, 56L,
                        102L, 103L, 104L, 155L, 156L, 157L, 158L, 159L, 160L, 161L, 162L);
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', textBlock = """
            1 | A       | 22
            1 | B       | -
            1 | UNKNOWN | -
            2 | A       | -
            2 | B       | 20
            2 | UNKNOWN | -
            3 | A       | -
            3 | B       | 70,71
            3 | UNKNOWN | -
            4 | A       | -
            4 | B       | 54,55
            4 | UNKNOWN | 72
            5 | A       | -
            5 | B       | 16,17
            5 | UNKNOWN | -
            6 | A       | -
            6 | B       | 121
            6 | UNKNOWN | 119
            7 | A       | -
            7 | B       | 57
            7 | UNKNOWN | 56
            8 | A       | -
            8 | B       | 102,103,104
            8 | UNKNOWN | -
            9 | A       | -
            9 | B       | 155,156,157,158,159,160
            9 | UNKNOWN | -
            10 | A      | 161,162
            10 | B      | -
            10 | UNKNOWN | -
            """)
    @DisplayName("각 문항의 A·B·UNKNOWN은 명시된 추가 ID 배열을 순서대로 제공한다")
    void shouldLoadEveryOptionRule(long questionId, String optionId, String ids) {
        List<Long> expected = ids.equals("-") ? List.of()
                : Arrays.stream(ids.split(",")).map(Long::valueOf).toList();

        assertThat(RULES.findOptionItemIds(questionId, optionId)).containsExactlyElementsOf(expected);
    }

    @Test
    @DisplayName("기본·추가·전체 참조 목록은 변경할 수 없다")
    void shouldKeepLoadedRulesImmutable() {
        assertThatThrownBy(() -> RULES.findBaseItemIds().clear()).isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> RULES.findOptionItemIds(1L, "A").clear()).isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> RULES.findAllItemIds().clear()).isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    @DisplayName("규칙 파일은 생성 시 한 번 읽고 반복 조회 시 다시 열지 않는다")
    void shouldReadFileOnlyOnce() throws IOException {
        Resource resource = spy(new InputStreamResource(
                new ByteArrayInputStream(VALID_JSON.getBytes(StandardCharsets.UTF_8))));
        BalanceGameRecommendationRuleRepository repository = fromResource(resource);

        for (int i = 0; i < 3; i++) {
            repository.findBaseItemIds();
            repository.findOptionItemIds(1L, "B");
            repository.findAllItemIds();
        }

        verify(resource, times(1)).getContentAsByteArray();
        verify(resource, times(1)).getInputStream();
    }

    @ParameterizedTest
    @MethodSource("invalidRequiredValues")
    @DisplayName("필수 배열·문항·선택지·양의 카탈로그 ID가 잘못되면 파일과 필드를 알리며 실패한다")
    void shouldRejectInvalidRequiredValues(String json, String field) {
        assertThatThrownBy(() -> fromJson(json)).isInstanceOf(IllegalStateException.class)
                .hasMessageContainingAll("test-rules.json", field);
    }

    static Stream<Arguments> invalidRequiredValues() {
        return Stream.of(
                Arguments.of("{}", "baseItemIds"),
                Arguments.of("{\"baseItemIds\":null,\"rules\":[]}", "baseItemIds"),
                Arguments.of("{\"baseItemIds\":[],\"rules\":null}", "rules"),
                Arguments.of("{\"baseItemIds\":[],\"rules\":[null]}", "rules"),
                Arguments.of(VALID_JSON.replace("[100,101]", "[null]"), "baseItemIds"),
                Arguments.of(VALID_JSON.replace("[100,101]", "[0]"), "baseItemIds"),
                Arguments.of(VALID_JSON.replace("\"questionId\":1,", ""), "questionId"),
                Arguments.of(VALID_JSON.replace("\"questionId\":1,", "\"questionId\":0,"), "questionId"),
                Arguments.of(VALID_JSON.replace("[102]", "null"), "optionItemIds"),
                Arguments.of(VALID_JSON.replace("[102]", "[null]"), "optionItemIds"),
                Arguments.of(VALID_JSON.replace("[102]", "[-1]"), "optionItemIds"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "{", "[]", "null", "{\"baseItemIds\":true}", "{\"unknown\":[]}"})
    @DisplayName("잘못된 JSON 구조와 null 문서는 시작 시 실패한다")
    void shouldRejectMalformedRules(String json) {
        assertThatThrownBy(() -> fromJson(json)).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("test-rules.json");
    }

    @ParameterizedTest
    @MethodSource("invalidStructures")
    @DisplayName("뒤따르는 문서·중복 키·소수 ID·알 수 없는 필드는 거절한다")
    void shouldRejectAmbiguousStructure(String json) {
        assertThatThrownBy(() -> fromJson(json)).isInstanceOf(IllegalStateException.class);
    }

    static Stream<String> invalidStructures() {
        return Stream.of(VALID_JSON + "{}", VALID_JSON.replace("[102]", "[1.5]"),
                VALID_JSON.replace("\"baseItemIds\":", "\"baseItemIds\":[],\"baseItemIds\":"),
                VALID_JSON.replace("\"B\":[]", "\"B\":[],\"B\":[103]"),
                VALID_JSON.replace("\"baseItemIds\"", "\"baseItems\""));
    }

    @ParameterizedTest
    @MethodSource("invalidReferences")
    @DisplayName("빈 추가 배열과 달리 문항·선택지 규칙의 누락·미존재·중복은 거절한다")
    void shouldRejectMissingAndUnknownReferences(String json) {
        assertThatThrownBy(() -> fromJson(json)).isInstanceOf(IllegalStateException.class);
    }

    static Stream<String> invalidReferences() {
        return Stream.of(
                VALID_JSON.replace("\"questionId\":1,", "\"questionId\":999,"),
                VALID_JSON.replace("\"questionId\":2,", "\"questionId\":1,"),
                VALID_JSON.replace("\"B\":[],", ""),
                VALID_JSON.replace("\"UNKNOWN\":[]", "\"INVALID\":[]"),
                VALID_JSON.replace("\"B\":[]", "\"B\":[],\"EXTRA\":[]"),
                """
                {"baseItemIds":[],"rules":[{"questionId":1,"optionItemIds":{"A":[],"B":[],"UNKNOWN":[]}}]}
                """);
    }

    @Test
    @DisplayName("규칙 파일이 없으면 빈 기본 목록으로 대체하지 않는다")
    void shouldRejectMissingFile() {
        assertThatThrownBy(() -> fromResource(new ClassPathResource("balance-game/missing-rules.json")))
                .isInstanceOf(IllegalStateException.class).hasCauseInstanceOf(IOException.class);
    }

    private static BalanceGameRecommendationRuleRepository fromJson(String json) {
        return fromResource(new ByteArrayResource(json.getBytes(StandardCharsets.UTF_8), "test-rules.json"));
    }

    private static BalanceGameRecommendationRuleRepository fromResource(Resource resource) {
        return new BalanceGameRecommendationRuleRepository(MAPPER, VALIDATOR_FACTORY.getValidator(), QUESTIONS, resource);
    }
}
