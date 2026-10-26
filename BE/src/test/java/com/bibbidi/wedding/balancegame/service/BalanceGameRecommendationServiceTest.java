package com.bibbidi.wedding.balancegame.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.verifyNoInteractions;

import com.bibbidi.wedding.balancegame.adapter.ai.BalanceGameRecommender;
import com.bibbidi.wedding.balancegame.repository.BalanceGameQuestionRepository;
import com.bibbidi.wedding.balancegame.service.dto.BalanceGameAnswer;
import com.bibbidi.wedding.balancegame.service.dto.ResolvedBalanceGameAnswer;
import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import jakarta.validation.Validation;
import jakarta.validation.ValidatorFactory;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.ClassPathResource;
import tools.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
class BalanceGameRecommendationServiceTest {

    private static final ValidatorFactory VALIDATOR_FACTORY = Validation.buildDefaultValidatorFactory();
    private static final BalanceGameQuestionRepository QUESTIONS = new BalanceGameQuestionRepository(
            new ObjectMapper(), VALIDATOR_FACTORY.getValidator(),
            new ClassPathResource("balance-game/questions.json"), "https://images.test");
    private static final CatalogItemDetailSnapshot CONTRACT =
            new CatalogItemDetailSnapshot(100L, "계약서 확인", "웨딩홀", 1, "웨딩홀 계약");
    private static final CatalogItemDetailSnapshot ESTIMATE =
            new CatalogItemDetailSnapshot(101L, "견적 비교", "웨딩홀", 1, "웨딩홀 계약");
    private static final List<CatalogItemDetailSnapshot> CATALOG = List.of(ESTIMATE, CONTRACT);

    @Mock
    private CatalogService catalogService;

    @Mock
    private BalanceGameRecommender recommender;

    private BalanceGameRecommendationService service;

    @BeforeEach
    void setUp() {
        service = new BalanceGameRecommendationService(QUESTIONS, catalogService, recommender);
    }

    @AfterAll
    static void closeValidatorFactory() {
        VALIDATOR_FACTORY.close();
    }

    @Test
    @DisplayName("문항 저장소의 실제 문구와 전체 카탈로그를 전달하고 UNKNOWN은 그대로 해석한다")
    void shouldResolveAnswersAndPassCatalogToAi() {
        given(catalogService.findAllItemDetails()).willReturn(CATALOG);
        given(recommender.recommend(anyList(), same(CATALOG))).willReturn(List.of(100L));

        service.recommend(validAnswers());

        ArgumentCaptor<List<ResolvedBalanceGameAnswer>> captor = ArgumentCaptor.captor();
        then(recommender).should().recommend(captor.capture(), same(CATALOG));
        assertThat(captor.getValue()).hasSize(QUESTIONS.findAll().size());
        assertThat(captor.getValue().getFirst()).isEqualTo(new ResolvedBalanceGameAnswer(
                1L, "결혼식 날, 어떤 사진을 남기고 싶어?", "A", "기본 촬영에 더해, 아이폰으로 생생한 현장 사진도 남길래."));
        assertThat(captor.getValue().get(1)).isEqualTo(new ResolvedBalanceGameAnswer(
                2L, "결혼식이 끝난 뒤, 꼭 다시 꺼내보고 싶은 것은?", "UNKNOWN", "아직 잘 모르겠어"));
        then(catalogService).should().findAllItemDetails();
    }

    @Test
    @DisplayName("AI 추천 순서를 유지하고 중복을 제거한 실제 카탈로그 항목을 반환한다")
    void shouldPreserveRecommendationOrderAndRemoveDuplicates() {
        given(catalogService.findAllItemDetails()).willReturn(CATALOG);
        given(recommender.recommend(anyList(), same(CATALOG))).willReturn(List.of(100L, 101L, 100L));

        assertThat(service.recommend(validAnswers())).containsExactly(CONTRACT, ESTIMATE);
    }

    @Test
    @DisplayName("후보에 없는 추천 ID가 섞이면 전체 추천을 기존 서버 오류로 거절한다")
    void shouldRejectUnknownRecommendedItemId() {
        given(catalogService.findAllItemDetails()).willReturn(CATALOG);
        given(recommender.recommend(anyList(), same(CATALOG))).willReturn(List.of(100L, 999L));

        assertThatThrownBy(() -> service.recommend(validAnswers()))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.clientError()).isEqualTo(ClientError.INTERNAL_ERROR));
    }

    @ParameterizedTest
    @MethodSource("invalidAnswers")
    @DisplayName("없는 문항·선택지와 중복·누락 답변은 카탈로그와 AI를 호출하기 전에 거절한다")
    void shouldRejectInvalidAnswersBeforeCatalogOrAiCall(List<BalanceGameAnswer> answers) {
        assertThatThrownBy(() -> service.recommend(answers))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.clientError()).isEqualTo(ClientError.INVALID_REQUEST));
        verifyNoInteractions(catalogService, recommender);
    }

    static Stream<List<BalanceGameAnswer>> invalidAnswers() {
        List<BalanceGameAnswer> valid = validAnswers();
        List<BalanceGameAnswer> duplicate = new ArrayList<>(valid);
        duplicate.set(duplicate.size() - 1, valid.getFirst());
        return Stream.of(
                List.of(new BalanceGameAnswer(999L, "A")),
                List.of(new BalanceGameAnswer(1L, "INVALID")),
                duplicate,
                valid.subList(0, valid.size() - 1));
    }

    private static List<BalanceGameAnswer> validAnswers() {
        return QUESTIONS.findAll().stream()
                .map(question -> new BalanceGameAnswer(question.id(), question.id() == 2 ? "UNKNOWN" : "A"))
                .toList();
    }
}
