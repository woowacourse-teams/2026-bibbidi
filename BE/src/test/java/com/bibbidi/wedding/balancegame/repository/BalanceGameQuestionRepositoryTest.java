package com.bibbidi.wedding.balancegame.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.balancegame.domain.BalanceGameQuestion;
import com.bibbidi.wedding.balancegame.domain.BalanceGameQuestion.Choice;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.nio.charset.StandardCharsets;
import javax.sql.DataSource;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import tools.jackson.databind.ObjectMapper;

class BalanceGameQuestionRepositoryTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final ValidatorFactory VALIDATOR_FACTORY = Validation.buildDefaultValidatorFactory();
    private static final String QUESTION = """
            {"id": 10, "order": 1, "question": "먼저 표시할 질문", "options": [
              {"id": "B", "text": "먼저 표시할 선택지", "imagePath": "/balance-game/q01-b.webp"},
              {"id": "UNKNOWN", "text": "아직 잘 모르겠어", "imagePath": null},
              {"id": "A", "text": "나중에 표시할 선택지", "imagePath": null}
            ]}
            """;
    private static final String VALID_JSON = "{\"questions\":[" + QUESTION + "]}";

    @AfterAll
    static void closeValidatorFactory() {
        VALIDATOR_FACTORY.close();
    }

    @Test
    @DisplayName("문항은 노출 순서대로 정렬하고 선택지는 JSON 배열 순서를 유지한다")
    void shouldSortQuestionsAndPreserveChoiceOrder() {
        String laterQuestion = QUESTION.replace("\"id\": 10", "\"id\": 5")
                .replace("\"order\": 1", "\"order\": 2");
        BalanceGameQuestionRepository repository = fromJson(
                "{\"questions\":[" + laterQuestion + "," + QUESTION + "]}");

        assertThat(repository.findAll()).extracting(BalanceGameQuestion::id).containsExactly(10L, 5L);
        assertThat(repository.findAll()).extracting(BalanceGameQuestion::order).containsExactly(1, 2);
        assertThat(repository.findAll().getFirst().choices()).extracting(Choice::id)
                .containsExactly("B", "UNKNOWN", "A");
        assertThat(repository.findAll().getFirst().choices().getFirst()).isEqualTo(
                new Choice("B", "먼저 표시할 선택지", "/balance-game/q01-b.webp"));
        assertThat(repository.findAll().getFirst().choices().get(1)).isEqualTo(
                new Choice("UNKNOWN", "아직 잘 모르겠어", null));
    }

    @ParameterizedTest
    @ValueSource(strings = {"loadtest", "prod,loadtest"})
    @DisplayName("부하 프로필에서도 이미지 도메인 설정과 외부 DB 없이 실제 문항 저장소를 생성한다")
    void shouldLoadWithoutImageBaseUrlForLoadtestProfiles(String profiles) {
        new ApplicationContextRunner()
                .withInitializer(new ConfigDataApplicationContextInitializer())
                .withPropertyValues("spring.profiles.active=" + profiles)
                .withBean(ObjectMapper.class, () -> MAPPER)
                .withBean(Validator.class, VALIDATOR_FACTORY::getValidator)
                .withUserConfiguration(BalanceGameQuestionRepository.class)
                .run(context -> {
                    assertThat(context).hasNotFailed().hasSingleBean(BalanceGameQuestionRepository.class)
                            .doesNotHaveBean(DataSource.class);
                    assertThat(context.getEnvironment().getActiveProfiles()).containsExactly(profiles.split(","));
                    assertThat(context.getEnvironment().getProperty("bibbidi.balance-game.image-base-url")).isNull();
                    BalanceGameQuestionRepository repository = context.getBean(BalanceGameQuestionRepository.class);
                    assertThat(repository.findAll()).hasSize(10);
                    assertThat(repository.findAll().getFirst().choices().getFirst().imagePath())
                            .isEqualTo("/balance-game/q01-a.webp");
                    assertThat(repository.findAll().getLast().choices().get(1).imagePath())
                            .isEqualTo("/balance-game/q10-b.webp");
                    assertThat(repository.findAll().getFirst().choices().getLast().imagePath()).isNull();
                });
    }

    @Test
    @DisplayName("이미지가 없는 선택지는 null을 유지한다")
    void shouldKeepNullImagePaths() {
        BalanceGameQuestionRepository repository = fromJson(
                VALID_JSON.replace("\"/balance-game/q01-b.webp\"", "null"));

        assertThat(repository.findAll().getFirst().choices())
                .allSatisfy(option -> assertThat(option.imagePath()).isNull());
    }

    @Test
    @DisplayName("문항과 선택지 목록은 외부에서 변경할 수 없다")
    void shouldKeepQuestionsAndChoicesImmutable() {
        BalanceGameQuestionRepository repository = fromJson(VALID_JSON);

        assertThatThrownBy(() -> repository.findAll().clear())
                .isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> repository.findAll().getFirst().choices().clear())
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    @DisplayName("실제 문항 파일에는 기획의 전체 10문항과 공통 미정 선택지가 있다")
    void shouldLoadAllPlannedQuestions() {
        BalanceGameQuestionRepository repository = fromResource(new ClassPathResource("balance-game/questions.json"));

        assertThat(repository.findAll()).hasSize(10);
        assertThat(repository.findAll()).extracting(BalanceGameQuestion::order)
                .containsExactly(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
        assertThat(repository.findAll()).allSatisfy(question -> {
            assertThat(question.choices()).extracting(Choice::id).containsExactly("A", "B", "UNKNOWN");
            assertThat(question.choices()).extracting(Choice::imagePath).containsExactly(
                    "/balance-game/q%02d-a.webp".formatted(question.id()),
                    "/balance-game/q%02d-b.webp".formatted(question.id()),
                    null);
        });
        assertThat(repository.findAll().getFirst().choices().getFirst().text())
                .isEqualTo("기본 촬영에 더해, 아이폰으로 생생한 현장 사진도 남길래.");
        assertThat(repository.findAll().getFirst().choices().getFirst().imagePath())
                .isEqualTo("/balance-game/q01-a.webp");
        assertThat(repository.findAll().getLast().choices().get(1).imagePath())
                .isEqualTo("/balance-game/q10-b.webp");
        assertThat(repository.findAll().getLast().content()).isEqualTo("결혼 후 함께 살 집을 떠올리면?");
    }

    private static BalanceGameQuestionRepository fromJson(String json) {
        return fromResource(new ByteArrayResource(json.getBytes(StandardCharsets.UTF_8), "test-questions.json"));
    }

    private static BalanceGameQuestionRepository fromResource(Resource resource) {
        return new BalanceGameQuestionRepository(MAPPER, VALIDATOR_FACTORY.getValidator(), resource);
    }
}
