package com.bibbidi.wedding.balancegame.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.verifyNoInteractions;

import com.bibbidi.wedding.balancegame.repository.BalanceGameQuestionRepository;
import com.bibbidi.wedding.balancegame.repository.BalanceGameRecommendationRuleRepository;
import com.bibbidi.wedding.balancegame.service.dto.BalanceGameAnswer;
import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import jakarta.validation.Validation;
import jakarta.validation.ValidatorFactory;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.ByteArrayResource;
import tools.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
class BalanceGameRecommendationServiceTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final ValidatorFactory VALIDATOR_FACTORY = Validation.buildDefaultValidatorFactory();
    private static final BalanceGameQuestionRepository QUESTIONS = new BalanceGameQuestionRepository(
            MAPPER, VALIDATOR_FACTORY.getValidator(), json("""
            {"questions":[
              {"id":10,"order":2,"question":"나중 문항","options":[
                {"id":"A","text":"선택 A"},{"id":"B","text":"선택 B"},
                {"id":"UNKNOWN","text":"미정"}]},
              {"id":20,"order":1,"question":"먼저 문항","options":[
                {"id":"A","text":"선택 A"},{"id":"B","text":"선택 B"},
                {"id":"UNKNOWN","text":"미정"}]}
            ]}
            """), "");
    private static final String RULES = """
            {"baseItemIds":[100,101,100],"rules":[
              {"questionId":10,"optionItemIds":{"A":[103,101],"B":[],"UNKNOWN":[]}},
              {"questionId":20,"optionItemIds":{"A":[102,100,102],"B":[],"UNKNOWN":[104]}}
            ]}
            """;
    private static final CatalogItemDetailSnapshot BASE = item(100L, "공통 준비");
    private static final CatalogItemDetailSnapshot SECOND_BASE = item(101L, "다른 공통 준비");
    private static final CatalogItemDetailSnapshot EARLY = item(102L, "먼저 문항의 추가 준비");
    private static final CatalogItemDetailSnapshot LATE = item(103L, "나중 문항의 추가 준비");
    private static final CatalogItemDetailSnapshot UNDECIDED = item(104L, "미정일 때 확인할 준비");
    private static final List<CatalogItemDetailSnapshot> CATALOG = List.of(LATE, UNDECIDED, SECOND_BASE, EARLY, BASE);

    @Mock
    private CatalogService catalogService;

    private BalanceGameRecommendationService service;

    @BeforeEach
    void setUp() {
        service = serviceWithRules(RULES);
    }

    @AfterAll
    static void closeValidatorFactory() {
        VALIDATOR_FACTORY.close();
    }

    @Test
    @DisplayName("공통 항목 다음에 문항 order 순으로 추가하고 최초 순서를 유지해 중복을 제거한다")
    void shouldCombineInQuestionOrderAndMapActualCatalogData() {
        given(catalogService.findAllItemDetails()).willReturn(CATALOG);

        assertThat(service.recommend(List.of(new BalanceGameAnswer(10L, "A"), new BalanceGameAnswer(20L, "A"))))
                .containsExactly(BASE, SECOND_BASE, EARLY, LATE);
        then(catalogService).should().findAllItemDetails();
    }

    @Test
    @DisplayName("답변 배열의 순서가 달라도 결과는 같다")
    void shouldIgnoreAnswerArrayOrder() {
        given(catalogService.findAllItemDetails()).willReturn(CATALOG);

        assertThat(service.recommend(List.of(new BalanceGameAnswer(10L, "A"), new BalanceGameAnswer(20L, "A"))))
                .isEqualTo(service.recommend(List.of(new BalanceGameAnswer(20L, "A"), new BalanceGameAnswer(10L, "A"))));
    }

    @Test
    @DisplayName("빈 추가 목록을 선택해도 공통 항목을 유지하고 다른 선택 항목을 추가하지 않는다")
    void shouldKeepBaseItemsWhenNoAdditionsAreSelected() {
        given(catalogService.findAllItemDetails()).willReturn(CATALOG);

        assertThat(service.recommend(List.of(new BalanceGameAnswer(10L, "B"), new BalanceGameAnswer(20L, "B"))))
                .containsExactly(BASE, SECOND_BASE);
    }

    @Test
    @DisplayName("UNKNOWN은 해당 선택지에 정의한 항목만 추가한다")
    void shouldApplyExplicitUnknownRule() {
        given(catalogService.findAllItemDetails()).willReturn(CATALOG);

        assertThat(service.recommend(List.of(
                new BalanceGameAnswer(10L, "UNKNOWN"), new BalanceGameAnswer(20L, "UNKNOWN"))))
                .containsExactly(BASE, SECOND_BASE, UNDECIDED);
    }

    @ParameterizedTest
    @MethodSource("missingCatalogIds")
    @DisplayName("기본 항목이나 선택하지 않은 분기의 ID도 카탈로그에 없으면 전체 추천을 거절한다")
    void shouldRejectAnyMissingCatalogReference(long missingId) {
        given(catalogService.findAllItemDetails()).willReturn(CATALOG.stream()
                .filter(item -> item.id() != missingId).toList());

        assertThatThrownBy(() -> service.recommend(List.of(
                new BalanceGameAnswer(10L, "B"), new BalanceGameAnswer(20L, "B"))))
                .isInstanceOfSatisfying(BusinessException.class, exception -> {
                    assertThat(exception.clientError()).isEqualTo(ClientError.INTERNAL_ERROR);
                    assertThat(exception.getMessage()).contains("id=" + missingId);
                });
    }

    static Stream<Long> missingCatalogIds() {
        return Stream.of(100L, 103L, 104L);
    }

    @Test
    @DisplayName("참조 ID가 없으면 이름이 같은 다른 항목으로 대체하지 않는다")
    void shouldNotSubstituteAnotherItemWithSameTitle() {
        given(catalogService.findAllItemDetails()).willReturn(List.of(
                item(999L, BASE.title()), SECOND_BASE, EARLY, LATE, UNDECIDED));

        assertThatThrownBy(() -> service.recommend(List.of(
                new BalanceGameAnswer(10L, "B"), new BalanceGameAnswer(20L, "B"))))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.clientError()).isEqualTo(ClientError.INTERNAL_ERROR));
    }

    @Test
    @DisplayName("기본 목록이 빈 fixture에서도 추가 목록을 조합할 수 있다")
    void shouldSupportEmptyBaseFixture() {
        given(catalogService.findAllItemDetails()).willReturn(CATALOG);
        BalanceGameRecommendationService fixtureService = serviceWithRules(RULES.replace("[100,101,100]", "[]"));

        assertThat(fixtureService.recommend(List.of(new BalanceGameAnswer(10L, "B"), new BalanceGameAnswer(20L, "UNKNOWN"))))
                .containsExactly(UNDECIDED);
    }

    @ParameterizedTest
    @MethodSource("invalidAnswers")
    @DisplayName("없는 문항·선택지와 중복·누락 답변은 카탈로그 조회 전에 거절한다")
    void shouldRejectInvalidAnswersBeforeCatalogCall(List<BalanceGameAnswer> answers) {
        assertThatThrownBy(() -> service.recommend(answers))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.clientError()).isEqualTo(ClientError.INVALID_REQUEST));
        verifyNoInteractions(catalogService);
    }

    static Stream<List<BalanceGameAnswer>> invalidAnswers() {
        return Stream.of(
                List.of(new BalanceGameAnswer(999L, "A")),
                List.of(new BalanceGameAnswer(10L, "INVALID")),
                List.of(new BalanceGameAnswer(10L, "A"), new BalanceGameAnswer(10L, "B")),
                List.of(new BalanceGameAnswer(10L, "A")));
    }

    private BalanceGameRecommendationService serviceWithRules(String rules) {
        return new BalanceGameRecommendationService(QUESTIONS, catalogService,
                new BalanceGameRecommendationRuleRepository(MAPPER, VALIDATOR_FACTORY.getValidator(), QUESTIONS, json(rules)));
    }

    private static ByteArrayResource json(String content) {
        return new ByteArrayResource(content.getBytes(StandardCharsets.UTF_8));
    }

    private static CatalogItemDetailSnapshot item(Long id, String title) {
        return new CatalogItemDetailSnapshot(id, title, "실제 카테고리", 3, "실제 단계");
    }
}
