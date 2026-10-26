package com.bibbidi.wedding.balancegame.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.bibbidi.wedding.balancegame.domain.BalanceGameQuestion;
import com.bibbidi.wedding.balancegame.domain.BalanceGameQuestion.Choice;
import jakarta.validation.Validation;
import jakarta.validation.ValidatorFactory;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import tools.jackson.databind.ObjectMapper;

class BalanceGameQuestionRepositoryTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final ValidatorFactory VALIDATOR_FACTORY = Validation.buildDefaultValidatorFactory();
    private static final String QUESTION = """
            {"id": 10, "order": 1, "question": "먼저 표시할 질문", "options": [
              {"id": "B", "text": "먼저 표시할 선택지", "imageUrl": "https://images.test/option.webp"},
              {"id": "UNKNOWN", "text": "아직 잘 모르겠어", "imageUrl": null},
              {"id": "A", "text": "나중에 표시할 선택지", "imageUrl": null}
            ]}
            """;
    private static final String VALID_JSON = "{\"questions\":[" + QUESTION + "]}";

    @AfterAll
    static void closeValidatorFactory() {
        VALIDATOR_FACTORY.close();
    }

    @Test
    @DisplayName("문항은 노출 순서대로 정렬하고 선택지는 JSON 배열 순서를 유지한다")
    void shouldSortQuestionsAndPreserveOptionOrder() {
        String laterQuestion = QUESTION.replace("\"id\": 10", "\"id\": 5")
                .replace("\"order\": 1", "\"order\": 2");
        BalanceGameQuestionRepository repository = fromJson(
                "{\"questions\":[" + laterQuestion + "," + QUESTION + "]}");

        assertThat(repository.findAll()).extracting(BalanceGameQuestion::id).containsExactly(10L, 5L);
        assertThat(repository.findAll()).extracting(BalanceGameQuestion::order).containsExactly(1, 2);
        assertThat(repository.findAll().getFirst().options()).extracting(Choice::id)
                .containsExactly("B", "UNKNOWN", "A");
        assertThat(repository.findOptionById(10L, "B")).contains(
                new Choice("B", "먼저 표시할 선택지", "https://images.test/option.webp"));
        assertThat(repository.findOptionById(10L, "UNKNOWN")).contains(
                new Choice("UNKNOWN", "아직 잘 모르겠어", null));
    }

    @Test
    @DisplayName("같은 저장소에서 문항 ID와 문항 안의 선택지 ID로 조회한다")
    void shouldFindQuestionAndOptionById() {
        BalanceGameQuestionRepository repository = fromJson(VALID_JSON);

        assertThat(repository.findById(10L)).contains(repository.findAll().getFirst());
        assertThat(repository.findById(99L)).isEmpty();
        assertThat(repository.findOptionById(10L, "missing")).isEmpty();
        assertThat(repository.findOptionById(99L, "A")).isEmpty();
    }

    @Test
    @DisplayName("문항과 선택지 목록은 외부에서 변경할 수 없다")
    void shouldKeepQuestionsAndOptionsImmutable() {
        BalanceGameQuestionRepository repository = fromJson(VALID_JSON);

        assertThatThrownBy(() -> repository.findAll().clear())
                .isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> repository.findAll().getFirst().options().clear())
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    @DisplayName("반복 조회는 시작 시 읽은 데이터를 사용하고 파일을 다시 열지 않는다")
    void shouldReadFileOnlyOnce() throws IOException {
        Resource resource = spy(new InputStreamResource(
                new ByteArrayInputStream(VALID_JSON.getBytes(StandardCharsets.UTF_8))));
        BalanceGameQuestionRepository repository = fromResource(resource);
        List<BalanceGameQuestion> questions = repository.findAll();

        for (int i = 0; i < 3; i++) {
            assertThat(repository.findAll()).isSameAs(questions);
            repository.findById(10L);
            repository.findOptionById(10L, "UNKNOWN");
        }

        verify(resource, times(1)).getContentAsByteArray();
        verify(resource, times(1)).getInputStream();
    }

    @Test
    @DisplayName("실제 문항 파일에는 기획의 전체 10문항과 공통 미정 선택지가 있다")
    void shouldLoadAllPlannedQuestions() {
        BalanceGameQuestionRepository repository = fromResource(new ClassPathResource("balance-game/questions.json"));

        assertThat(repository.findAll()).hasSize(10);
        assertThat(repository.findAll()).extracting(BalanceGameQuestion::order)
                .containsExactly(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
        assertThat(repository.findAll()).allSatisfy(question -> {
            assertThat(question.options()).extracting(Choice::id).containsExactly("A", "B", "UNKNOWN");
            assertThat(question.options()).allSatisfy(option -> assertThat(option.imageUrl()).isNull());
        });
        assertThat(repository.findById(1L).orElseThrow().options().getFirst().text())
                .isEqualTo("기본 촬영에 더해, 아이폰으로 생생한 현장 사진도 남길래.");
        assertThat(repository.findById(10L).orElseThrow().question()).isEqualTo("결혼 후 함께 살 집을 떠올리면?");
    }

    @ParameterizedTest(name = "{1}")
    @MethodSource("invalidRequiredValues")
    @DisplayName("필수 값 누락과 빈 문구, 유효하지 않은 순서는 파일 위치와 필드를 알리며 실패한다")
    void shouldRejectInvalidRequiredValues(String json, String field) {
        assertThatThrownBy(() -> fromJson(json))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("test-questions.json")
                .hasMessageContaining(field);
    }

    static Stream<Arguments> invalidRequiredValues() {
        return Stream.of(
                Arguments.of("{}", "questions"),
                Arguments.of("{\"questions\":null}", "questions"),
                Arguments.of("{\"questions\":[]}", "questions"),
                Arguments.of("{\"questions\":[null]}", "questions[0]"),
                Arguments.of(VALID_JSON.replace("\"id\": 10,", ""), "id"),
                Arguments.of(VALID_JSON.replace("\"id\": 10", "\"id\": null"), "id"),
                Arguments.of(VALID_JSON.replace("\"id\": 10", "\"id\": 0"), "id"),
                Arguments.of(VALID_JSON.replace("\"order\": 1,", ""), "order"),
                Arguments.of(VALID_JSON.replace("\"order\": 1", "\"order\": null"), "order"),
                Arguments.of(VALID_JSON.replace("\"order\": 1", "\"order\": 0"), "order"),
                Arguments.of(VALID_JSON.replace("\"order\": 1", "\"order\": -1"), "order"),
                Arguments.of(VALID_JSON.replace("\"question\": \"먼저 표시할 질문\",", ""), "question"),
                Arguments.of(VALID_JSON.replace("\"먼저 표시할 질문\"", "null"), "question"),
                Arguments.of(VALID_JSON.replace("먼저 표시할 질문", "  "), "question"),
                Arguments.of("{\"questions\":[{\"id\":1,\"order\":1,\"question\":\"질문\"}]}", "options"),
                Arguments.of("{\"questions\":[{\"id\":1,\"order\":1,\"question\":\"질문\",\"options\":[]}]}", "options"),
                Arguments.of("{\"questions\":[{\"id\":1,\"order\":1,\"question\":\"질문\",\"options\":[null]}]}", "options"),
                Arguments.of(VALID_JSON.replace("\"id\": \"B\",", ""), "options[0].id"),
                Arguments.of(VALID_JSON.replace("\"id\": \"B\"", "\"id\": \" \""), "options[0].id"),
                Arguments.of(VALID_JSON.replace("\"text\": \"먼저 표시할 선택지\",", ""), "options[0].text"),
                Arguments.of(VALID_JSON.replace("\"먼저 표시할 선택지\"", "null"), "options[0].text"),
                Arguments.of(VALID_JSON.replace("먼저 표시할 선택지", "  "), "options[0].text")
        );
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "{", "[]", "{\"questions\":true}"})
    @DisplayName("깨진 JSON과 잘못된 문서 구조는 원인 예외를 보존하며 실패한다")
    void shouldRejectMalformedJson(String json) {
        assertThatThrownBy(() -> fromJson(json))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("test-questions.json")
                .hasCauseInstanceOf(RuntimeException.class);
    }

    @Test
    @DisplayName("문서 뒤의 JSON과 잘못된 필드명, 소수 순서를 허용하지 않는다")
    void shouldRejectTrailingJsonAndUnknownFieldsAndFractionalOrder() {
        for (String json : List.of(VALID_JSON + "{}", VALID_JSON.replace("\"imageUrl\"", "\"image\""),
                VALID_JSON.replace("\"order\": 1", "\"order\": 1.5"))) {
            assertThatThrownBy(() -> fromJson(json)).isInstanceOf(IllegalStateException.class);
        }
    }

    @Test
    @DisplayName("숫자 문자열은 공용 ObjectMapper의 기본 변환 정책을 따른다")
    void shouldUseSharedMapperCoercionPolicy() {
        BalanceGameQuestionRepository repository = fromJson(VALID_JSON
                .replace("\"id\": 10", "\"id\": \"10\"")
                .replace("\"order\": 1", "\"order\": \"1\""));

        assertThat(repository.findAll().getFirst().id()).isEqualTo(10L);
        assertThat(repository.findAll().getFirst().order()).isEqualTo(1);
    }

    @Test
    @DisplayName("한 JSON 객체의 중복 키는 공용 ObjectMapper의 기본 정책을 따른다")
    void shouldUseSharedMapperDuplicateKeyPolicy() {
        BalanceGameQuestionRepository repository = fromJson(
                VALID_JSON.replace("\"order\": 1", "\"order\": 1, \"order\": 2"));

        assertThat(repository.findAll().getFirst().order()).isEqualTo(2);
    }

    @Test
    @DisplayName("문항 ID가 중복되면 문항 ID를 알리며 실패한다")
    void shouldRejectDuplicateQuestionId() {
        assertThatThrownBy(() -> fromJson("{\"questions\":[" + QUESTION + ","
                + QUESTION.replace("\"order\": 1", "\"order\": 2") + "]}"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContainingAll("문항 ID가 중복", "id=10");
    }

    @Test
    @DisplayName("문항 노출 순서가 중복되면 해당 순서를 알리며 실패한다")
    void shouldRejectDuplicateOrder() {
        assertThatThrownBy(() -> fromJson("{\"questions\":[" + QUESTION + ","
                + QUESTION.replace("\"id\": 10", "\"id\": 20") + "]}"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContainingAll("노출 순서가 중복", "order=1");
    }

    @Test
    @DisplayName("한 문항 안의 선택지 ID가 중복되면 문항과 선택지 ID를 알리며 실패한다")
    void shouldRejectDuplicateOptionId() {
        assertThatThrownBy(() -> fromJson(VALID_JSON.replace("\"id\": \"A\"", "\"id\": \"B\"")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContainingAll("선택지 ID가 중복", "questionId=10", "optionId=B");
    }

    @Test
    @DisplayName("없는 파일을 빈 목록으로 대체하지 않고 원인을 보존한다")
    void shouldRejectMissingFile() {
        assertThatThrownBy(() -> fromResource(new ClassPathResource("balance-game/missing.json")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("balance-game/missing.json")
                .hasCauseInstanceOf(IOException.class);
    }

    @Test
    @DisplayName("유효하지 않은 문항 파일은 빈 목록으로 서버를 시작하지 않는다")
    void shouldFailApplicationStartup() {
        new ApplicationContextRunner()
                .withBean(BalanceGameQuestionRepository.class, () -> fromJson("{\"questions\":[]}"))
                .run(context -> assertThat(context).hasFailed()
                        .getFailure().hasRootCauseInstanceOf(IllegalStateException.class)
                        .hasStackTraceContaining("questions"));
    }

    @Test
    @DisplayName("null 문서는 시작 시 실패한다")
    void shouldRejectNullDocument() {
        assertThatThrownBy(() -> fromJson("null"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContainingAll("null", "test-questions.json");
    }

    private static BalanceGameQuestionRepository fromJson(String json) {
        return fromResource(new ByteArrayResource(json.getBytes(StandardCharsets.UTF_8), "test-questions.json"));
    }

    private static BalanceGameQuestionRepository fromResource(Resource resource) {
        return new BalanceGameQuestionRepository(MAPPER, VALIDATOR_FACTORY.getValidator(), resource);
    }
}
