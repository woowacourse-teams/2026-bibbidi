package com.bibbidi.wedding.balancegame.service;

import static java.util.Map.entry;
import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.balancegame.service.dto.BalanceGameAnswer;
import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.support.BibbidiIntegrationTest;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.LongStream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.jdbc.Sql;

class BalanceGameRecommendationCatalogIntegrationTest extends BibbidiIntegrationTest {

    @Autowired
    private CatalogService catalogService;

    @Autowired
    private BalanceGameRecommendationService recommendationService;

    @Test
    @Sql("/load_catalog.sql")
    @DisplayName("실제 카탈로그에서 확정 기본·모든 분기의 ID와 의미를 확인하고 UNKNOWN 규칙을 조합한다")
    void shouldValidateRulesAgainstCatalogSourceData() {
        // 참조 ID의 의미가 바뀌면 추천 규칙도 함께 검토한다.
        Map<Long, String> expectedTitles = Map.ofEntries(
                entry(139L, "총예산 수립"), entry(140L, "예비비 편성"),
                entry(141L, "예식 희망 날짜 범위 결정"), entry(142L, "예식 지역 결정"),
                entry(43L, "계약금·중도금·잔금 일정 확정"), entry(1L, "웨딩홀 투어"),
                entry(2L, "웨딩홀 계약"), entry(3L, "예식 형태 결정"),
                entry(4L, "입장 방식 결정"), entry(5L, "식순 준비"),
                entry(6L, "주례·사회자 섭외"), entry(10L, "축의대 담당자 섭외·역할 안내"),
                entry(12L, "사회자 대본 준비"), entry(13L, "성혼선언문 준비"),
                entry(14L, "혼인서약문 준비"), entry(15L, "본식음원 선정"),
                entry(18L, "본식음원 웨딩홀 전달"), entry(28L, "부케·부토니아·코사지 예약"),
                entry(33L, "본식 당일 개인 준비물 준비"), entry(34L, "본식 진행"),
                entry(35L, "예식비용 정산"), entry(19L, "본식스냅 계약"),
                entry(49L, "촬영 날짜 확정"), entry(60L, "촬영 시안 제작"),
                entry(61L, "참고 사진·레퍼런스 전달"), entry(68L, "촬영 사진 셀렉"),
                entry(69L, "보정본 수령"), entry(41L, "스드메 구성 결정"),
                entry(47L, "드레스샵 확정"), entry(48L, "헤어메이크업 샵 선택"),
                entry(50L, "헤어메이크업 일정 확정"), entry(52L, "촬영 드레스 선택과 가봉"),
                entry(73L, "예복 상담과 계약"), entry(74L, "본식 드레스샵 계약"),
                entry(75L, "본식 드레스 선택과 가봉"), entry(80L, "웨딩슈즈 준비"),
                entry(81L, "속옷·이너 준비"), entry(82L, "본식 헤어 결정"),
                entry(84L, "본식 메이크업 진행"), entry(85L, "대여 물품 반납"),
                entry(86L, "하객 초대 범위 결정"), entry(87L, "예상 하객수 산정"),
                entry(88L, "하객 명단 작성"), entry(89L, "청첩장 문구 작성"),
                entry(90L, "청첩장 교통·주차 안내 반영"), entry(97L, "모바일 청첩장 제작"),
                entry(100L, "모바일 청첩장 발송"), entry(101L, "식장 보증 인원 통보"),
                entry(105L, "식권 준비"), entry(106L, "축의금 정리"),
                entry(107L, "축의금 명단 정리"), entry(108L, "잔여 식권·식대 정산"),
                entry(109L, "하객 감사 인사 전달"), entry(152L, "신혼여행지 결정"),
                entry(153L, "항공권 예약"), entry(154L, "숙소 예약"),
                entry(163L, "인테리어·공사 범위 결정"), entry(164L, "혼수 목록 결정"),
                entry(165L, "가전·가구 계약"), entry(166L, "이사 업체 예약"),
                entry(167L, "신혼집 입주"), entry(168L, "전입신고·확정일자 처리"),
                entry(169L, "혼인신고 접수"), entry(22L, "아이폰스냅 계약"),
                entry(20L, "본식DVD 계약"), entry(70L, "앨범 구성 결정과 주문"),
                entry(71L, "액자 주문"), entry(54L, "맞춤 예복 치수 측정"),
                entry(55L, "예복 가봉"), entry(72L, "예복 맞춤·기성·대여 결정"),
                entry(16L, "식전영상 제작"), entry(17L, "식전영상 웨딩홀 전달"),
                entry(121L, "폐백 진행"), entry(119L, "폐백 여부 결정"),
                entry(57L, "헤어변형 업체 별도 예약"), entry(56L, "촬영 헤어변형 여부 결정"),
                entry(102L, "셔틀·대절버스 예약"), entry(103L, "장거리 하객 숙박 준비"),
                entry(104L, "하객 교통비 준비"), entry(155L, "여권 유효기간 확인"),
                entry(156L, "비자·입국 등록 확인"), entry(157L, "여행자보험 가입"),
                entry(158L, "해외결제 카드·트래블페이 준비"), entry(159L, "환전·외화 준비"),
                entry(160L, "로밍·eSIM 준비"), entry(161L, "신혼집 후보 조사"),
                entry(162L, "신혼집 계약"));
        Map<Long, String> actualTitles = catalogService.findAllItemDetails().stream()
                .collect(Collectors.toMap(CatalogItemDetailSnapshot::id, CatalogItemDetailSnapshot::title));

        assertThat(actualTitles).containsAllEntriesOf(expectedTitles);
        List<BalanceGameAnswer> answers = LongStream.rangeClosed(1, 10)
                .mapToObj(id -> new BalanceGameAnswer(id, "UNKNOWN")).toList();
        assertThat(recommendationService.recommend(answers)).extracting(CatalogItemDetailSnapshot::id)
                .hasSize(66)
                .endsWith(72L, 119L, 56L);
    }
}
