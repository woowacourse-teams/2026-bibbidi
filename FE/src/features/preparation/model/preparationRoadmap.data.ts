import {
  PreparationCatalogModel,
  PreparationCategoryModel,
  PreparationDetailTaskModel,
  PreparationStepModel,
} from "./preparationRoadmap";

interface PreparationStepData extends PreparationStepModel {
  tasks: PreparationDetailTaskModel[];
}

interface PreparationCategoryRoadmapData {
  category: PreparationCategoryModel;
  steps: PreparationStepData[];
  title: string;
}

const categoryRoadmaps = [
  {
    category: { id: "wedding-hall", label: "웨딩홀" },
    steps: [
      {
        description:
          "마음에 드는 웨딩홀을 직접 둘러보고, 조건을 꼼꼼히 비교해서 한 곳과 계약해요.",
        id: "step-1",
        order: 1,
        tasks: [
          { id: "catalog-item-1", title: "웨딩홀 투어" },
          { id: "catalog-item-2", title: "웨딩홀 계약" },
        ],
        title: "웨딩홀 투어와 계약",
      },
      {
        description:
          "어떤 분위기로 예식을 치를지 정하고, 식순과 입장 방식까지 그려봐요.",
        id: "step-2",
        order: 2,
        tasks: [
          { id: "catalog-item-3", title: "예식 형태 결정" },
          { id: "catalog-item-4", title: "입장 방식 결정" },
          { id: "catalog-item-5", title: "식순 준비" },
        ],
        title: "예식 형태·식순·입장 방식 결정",
      },
      {
        description:
          "주례와 사회자, 축가 담당을 구하고 당일 도와줄 사람도 함께 정해요.",
        id: "step-3",
        order: 3,
        tasks: [
          { id: "catalog-item-6", title: "주례·사회자 섭외" },
          { id: "catalog-item-7", title: "축가·축사·덕담 섭외" },
          { id: "catalog-item-8", title: "가방순이 섭외" },
          { id: "catalog-item-9", title: "부케순이 섭외" },
          { id: "catalog-item-10", title: "축의대 담당자 섭외·역할 안내" },
          { id: "catalog-item-11", title: "헬퍼비·사례비 봉투 준비" },
        ],
        title: "예식 진행자와 당일 도우미 섭외",
      },
      {
        description:
          "사회자 대본과 성혼선언문을 쓰고, 식전 영상과 본식 음악까지 준비해서 웨딩홀에 전달해요.",
        id: "step-4",
        order: 4,
        tasks: [
          { id: "catalog-item-12", title: "사회자 대본 준비" },
          { id: "catalog-item-13", title: "성혼선언문 준비" },
          { id: "catalog-item-14", title: "혼인서약문 준비" },
          { id: "catalog-item-15", title: "본식음원 선정" },
          { id: "catalog-item-16", title: "식전영상 제작" },
          { id: "catalog-item-17", title: "식전영상 웨딩홀 전달" },
          { id: "catalog-item-18", title: "본식음원 웨딩홀 전달" },
        ],
        title: "예식 대본과 음원·영상 준비",
      },
      {
        description:
          "소중한 순간을 사진과 영상으로 남겨줄 업체를 찾아 계약해요.",
        id: "step-5",
        order: 5,
        tasks: [
          { id: "catalog-item-19", title: "본식스냅 계약" },
          { id: "catalog-item-20", title: "본식DVD 계약" },
          { id: "catalog-item-21", title: "서브스냅 계약" },
          { id: "catalog-item-22", title: "아이폰스냅 계약" },
        ],
        title: "본식 촬영·기록 업체 계약",
      },
      {
        description:
          "부케, 접수대 물품처럼 예식장에 놓을 것들과 하객에게 전할 답례품을 챙겨요.",
        id: "step-6",
        order: 6,
        tasks: [
          { id: "catalog-item-23", title: "포토부스 설치 여부 결정" },
          { id: "catalog-item-24", title: "답례 대상·수량 정리" },
          { id: "catalog-item-25", title: "답례품 준비" },
          { id: "catalog-item-26", title: "포토테이블용 사진·액자 준비" },
          { id: "catalog-item-27", title: "식권·식순지·접수대 봉투 준비" },
          { id: "catalog-item-28", title: "부케·부토니아·코사지 예약" },
        ],
        title: "예식 물품과 답례품 준비",
      },
      {
        description:
          "미리 식사와 동선을 체크하고, 이동 차량과 숙소, 당일 짐까지 꼼꼼히 준비해요.",
        id: "step-7",
        order: 7,
        tasks: [
          { id: "catalog-item-29", title: "웨딩홀 시식" },
          { id: "catalog-item-30", title: "웨딩홀 리허설 방문" },
          { id: "catalog-item-31", title: "본식 전날 숙박 예약" },
          { id: "catalog-item-32", title: "예식장 이동 차량·트렁크 준비" },
          { id: "catalog-item-33", title: "본식 당일 개인 준비물 준비" },
        ],
        title: "웨딩홀 시식·리허설과 본식 당일 준비",
      },
      {
        description: "드디어 예식 당일, 그 하루를 마음껏 즐겨요.",
        id: "step-8",
        order: 8,
        tasks: [{ id: "catalog-item-34", title: "본식 진행" }],
        title: "본식 당일 진행",
      },
      {
        description:
          "예식 비용을 정산하고, 도와준 분들께 감사한 마음을 전해요.",
        id: "step-9",
        order: 9,
        tasks: [
          { id: "catalog-item-35", title: "예식비용 정산" },
          { id: "catalog-item-36", title: "사례비 전달" },
        ],
        title: "예식 비용 정산과 사례비 전달",
      },
    ],
    title: "웨딩홀 준비 로드맵",
  },
  {
    category: { id: "studio-dress-makeup", label: "스드메" },
    steps: [
      {
        description:
          "플래너 상담과 박람회로 시세를 알아보고, 마음에 드는 패키지를 골라 계약까지 마쳐요.",
        id: "step-10",
        order: 1,
        tasks: [
          { id: "catalog-item-37", title: "웨딩박람회 방문" },
          { id: "catalog-item-38", title: "플래너 배정과 상담" },
          { id: "catalog-item-39", title: "스드메 상담" },
          { id: "catalog-item-40", title: "스드메 견적 수령" },
          { id: "catalog-item-41", title: "스드메 구성 결정" },
          { id: "catalog-item-42", title: "스드메 계약" },
          { id: "catalog-item-43", title: "계약금·중도금·잔금 일정 확정" },
        ],
        title: "스드메 상담·견적과 패키지 계약",
      },
      {
        description:
          "드레스샵, 스튜디오, 헤어메이크업 샵을 정하고 촬영 날짜를 잡아요.",
        id: "step-11",
        order: 2,
        tasks: [
          { id: "catalog-item-44", title: "드레스샵 투어" },
          { id: "catalog-item-45", title: "스튜디오 선택" },
          { id: "catalog-item-46", title: "메이크업 상담" },
          { id: "catalog-item-47", title: "드레스샵 확정" },
          { id: "catalog-item-48", title: "헤어메이크업 샵 선택" },
          { id: "catalog-item-49", title: "촬영 날짜 확정" },
          { id: "catalog-item-50", title: "헤어메이크업 일정 확정" },
        ],
        title: "스드메 업체 확정과 촬영일 예약",
      },
      {
        description:
          "촬영에서 입을 드레스와 예복을 고르고 가봉하고, 헤어변형과 헬퍼도 미리 예약해요.",
        id: "step-12",
        order: 3,
        tasks: [
          { id: "catalog-item-51", title: "가봉 전 드레스 시착" },
          { id: "catalog-item-52", title: "촬영 드레스 선택과 가봉" },
          { id: "catalog-item-53", title: "촬영용 대여복 선택" },
          { id: "catalog-item-54", title: "맞춤 예복 치수 측정" },
          { id: "catalog-item-55", title: "예복 가봉" },
          { id: "catalog-item-56", title: "촬영 헤어변형 여부 결정" },
          { id: "catalog-item-57", title: "헤어변형 업체 별도 예약" },
          { id: "catalog-item-58", title: "촬영 플라워디렉팅 예약" },
          { id: "catalog-item-59", title: "촬영 헬퍼 섭외" },
        ],
        title: "촬영 드레스·예복 가봉과 헤어변형·헬퍼 예약",
      },
      {
        description: "원하는 촬영 분위기를 시안으로 정리해서 업체에 전달해요.",
        id: "step-13",
        order: 4,
        tasks: [
          { id: "catalog-item-60", title: "촬영 시안 제작" },
          { id: "catalog-item-61", title: "참고 사진·레퍼런스 전달" },
        ],
        title: "촬영 시안 제작과 업체 전달",
      },
      {
        description:
          "패키지에 없는 의상과 부케, 붙임머리 같은 소품을 따로 준비해요.",
        id: "step-14",
        order: 5,
        tasks: [
          { id: "catalog-item-62", title: "자유복·캐주얼 착장 준비" },
          { id: "catalog-item-63", title: "한복 촬영 착장 준비" },
          { id: "catalog-item-64", title: "붙임머리·가발 준비" },
          { id: "catalog-item-65", title: "촬영 부케 준비" },
        ],
        title: "촬영 추가 착장과 소품 준비",
      },
      {
        description: "촬영 당일을 즐기고, 야외 스냅을 추가할지도 결정해요.",
        id: "step-15",
        order: 6,
        tasks: [
          { id: "catalog-item-66", title: "야외·추가 스냅 여부 결정" },
          { id: "catalog-item-67", title: "스튜디오 촬영 진행" },
        ],
        title: "웨딩 촬영 당일 진행",
      },
      {
        description:
          "찍은 사진 중 마음에 드는 컷을 고르고 보정한 뒤, 앨범과 액자로 완성해요.",
        id: "step-16",
        order: 7,
        tasks: [
          { id: "catalog-item-68", title: "촬영 사진 셀렉" },
          { id: "catalog-item-69", title: "보정본 수령" },
          { id: "catalog-item-70", title: "앨범 구성 결정과 주문" },
          { id: "catalog-item-71", title: "액자 주문" },
        ],
        title: "촬영 사진 셀렉·보정과 앨범·액자 주문",
      },
      {
        description:
          "본식에서 입을 드레스와 예복을 계약하고, 헤어메이크업과 베일, 슈즈까지 정해요.",
        id: "step-17",
        order: 8,
        tasks: [
          { id: "catalog-item-72", title: "예복 맞춤·기성·대여 결정" },
          { id: "catalog-item-73", title: "예복 상담과 계약" },
          { id: "catalog-item-74", title: "본식 드레스샵 계약" },
          { id: "catalog-item-75", title: "본식 드레스 선택과 가봉" },
          { id: "catalog-item-76", title: "2부 드레스 결정" },
          { id: "catalog-item-77", title: "넥타이·보타이 선택" },
          { id: "catalog-item-78", title: "베일 선택" },
          { id: "catalog-item-79", title: "헤어피스·티아라 등 머리 장식 결정" },
          { id: "catalog-item-80", title: "웨딩슈즈 준비" },
          { id: "catalog-item-81", title: "속옷·이너 준비" },
          { id: "catalog-item-82", title: "본식 헤어 결정" },
          { id: "catalog-item-83", title: "2부 헤어변형 여부 결정" },
          { id: "catalog-item-84", title: "본식 메이크업 진행" },
        ],
        title: "본식 드레스·예복 계약과 헤어메이크업·소품 결정",
      },
      {
        description: "빌렸던 물품을 잊지 말고 돌려줘요.",
        id: "step-18",
        order: 9,
        tasks: [{ id: "catalog-item-85", title: "대여 물품 반납" }],
        title: "대여 물품 반납",
      },
    ],
    title: "스드메 준비 로드맵",
  },
  {
    category: { id: "invitation", label: "초대" },
    steps: [
      {
        description:
          "누구를 초대할지 범위를 정하고, 예상 인원과 명단을 정리해요.",
        id: "step-19",
        order: 1,
        tasks: [
          { id: "catalog-item-86", title: "하객 초대 범위 결정" },
          { id: "catalog-item-87", title: "예상 하객수 산정" },
          { id: "catalog-item-88", title: "하객 명단 작성" },
        ],
        title: "하객 범위 결정과 명단 작성",
      },
      {
        description: "청첩장에 담을 문구를 쓰고, 화환을 받을지도 함께 정해요.",
        id: "step-20",
        order: 2,
        tasks: [
          { id: "catalog-item-89", title: "청첩장 문구 작성" },
          { id: "catalog-item-90", title: "청첩장 교통·주차 안내 반영" },
          { id: "catalog-item-91", title: "화환 수령 여부 결정" },
        ],
        title: "청첩장 문구 작성과 화환 여부 결정",
      },
      {
        description:
          "모바일과 종이 청첩장 업체를 각각 정해서 원하는 수량으로 주문해요.",
        id: "step-21",
        order: 3,
        tasks: [
          { id: "catalog-item-92", title: "종이 청첩장 업체 선택" },
          { id: "catalog-item-93", title: "청첩장 수량 결정" },
          { id: "catalog-item-94", title: "청첩장 검수" },
          { id: "catalog-item-95", title: "청첩장 주문" },
          { id: "catalog-item-96", title: "모바일 청첩장 업체 선택" },
          { id: "catalog-item-97", title: "모바일 청첩장 제작" },
        ],
        title: "모바일·종이 청첩장 제작과 주문",
      },
      {
        description:
          "청첩장 모임을 열어 소중한 분들께 직접 전하고, 나머지는 모바일로 보내요.",
        id: "step-22",
        order: 4,
        tasks: [
          { id: "catalog-item-98", title: "청첩장 모임 진행" },
          { id: "catalog-item-99", title: "종이 청첩장 직접 전달" },
          { id: "catalog-item-100", title: "모바일 청첩장 발송" },
        ],
        title: "청첩장 모임과 전달",
      },
      {
        description: "최종 참석 인원을 확정해서 식장에 보증 인원으로 알려줘요.",
        id: "step-23",
        order: 5,
        tasks: [{ id: "catalog-item-101", title: "식장 보증 인원 통보" }],
        title: "참석 인원 확정과 식장 통보",
      },
      {
        description:
          "멀리서 오는 하객을 위해 셔틀버스를 준비하고 교통비도 챙겨요.",
        id: "step-24",
        order: 6,
        tasks: [
          { id: "catalog-item-102", title: "셔틀·대절버스 예약" },
          { id: "catalog-item-103", title: "장거리 하객 숙박 준비" },
          { id: "catalog-item-104", title: "하객 교통비 준비" },
        ],
        title: "하객 셔틀버스와 교통비 준비",
      },
      {
        description: "하객에게 나눠줄 식권을 준비해요.",
        id: "step-25",
        order: 7,
        tasks: [{ id: "catalog-item-105", title: "식권 준비" }],
        title: "식권 준비",
      },
      {
        description: "남은 식권과 식대를 정산하고, 축의금과 명단을 정리해요.",
        id: "step-26",
        order: 8,
        tasks: [
          { id: "catalog-item-106", title: "축의금 정리" },
          { id: "catalog-item-107", title: "축의금 명단 정리" },
          { id: "catalog-item-108", title: "잔여 식권·식대 정산" },
        ],
        title: "식대 정산과 축의금 정리",
      },
      {
        description: "와주신 하객분들께 감사 인사를 전해요.",
        id: "step-27",
        order: 9,
        tasks: [{ id: "catalog-item-109", title: "하객 감사 인사 전달" }],
        title: "하객 감사 인사 전달",
      },
    ],
    title: "초대 준비 로드맵",
  },
  {
    category: { id: "family", label: "가족" },
    steps: [
      {
        description:
          "양가가 만날 날짜와 장소를 정해 상견례를 치르고, 그 자리에서 예식 일정도 함께 조율해요.",
        id: "step-28",
        order: 1,
        tasks: [
          { id: "catalog-item-110", title: "양가 부모님 첫인사" },
          { id: "catalog-item-111", title: "상견례 날짜 확정" },
          { id: "catalog-item-112", title: "상견례 장소 선택과 예약" },
          { id: "catalog-item-113", title: "상견례 교통·숙박 준비" },
          { id: "catalog-item-114", title: "상견례 선물 준비" },
          { id: "catalog-item-115", title: "상견례 진행" },
          { id: "catalog-item-116", title: "예식 일정·조건 조율" },
        ],
        title: "상견례 일정·장소 예약과 진행",
      },
      {
        description:
          "예단을 주고받을지 양가와 이야기 나누고, 보낼 날짜를 정해요.",
        id: "step-29",
        order: 2,
        tasks: [
          { id: "catalog-item-117", title: "예단 여부 양가 협의" },
          { id: "catalog-item-118", title: "예단 전달 날짜 확정" },
        ],
        title: "예단 여부 협의와 날짜 결정",
      },
      {
        description: "폐백을 할지 정하고, 예식 당일 폐백까지 진행해요.",
        id: "step-30",
        order: 3,
        tasks: [
          { id: "catalog-item-119", title: "폐백 여부 결정" },
          { id: "catalog-item-120", title: "이바지 음식 예약" },
          { id: "catalog-item-121", title: "폐백 진행" },
        ],
        title: "폐백 여부 결정과 진행",
      },
      {
        description:
          "혼주 한복을 계약해 가봉하고, 정장과 드레스, 구두, 코사지까지 준비해요.",
        id: "step-31",
        order: 4,
        tasks: [
          { id: "catalog-item-122", title: "한복 대여·맞춤 결정" },
          { id: "catalog-item-123", title: "한복 업체 선택" },
          { id: "catalog-item-124", title: "혼주 한복 선택과 계약" },
          { id: "catalog-item-125", title: "한복 가봉" },
          { id: "catalog-item-126", title: "한복 소품 준비" },
          { id: "catalog-item-127", title: "혼주 예복 준비" },
          { id: "catalog-item-128", title: "혼주 드레스·양장 선택" },
          { id: "catalog-item-129", title: "혼주 구두·가방 선택" },
          { id: "catalog-item-130", title: "혼주 코사지·꽃 준비" },
        ],
        title: "혼주 한복·예복 계약과 소품 준비",
      },
      {
        description: "형제자매와 조부모님이 예식 날 입을 옷을 챙겨요.",
        id: "step-32",
        order: 5,
        tasks: [
          { id: "catalog-item-131", title: "형제자매 의상 준비" },
          { id: "catalog-item-132", title: "조부모 의상 준비" },
          { id: "catalog-item-133", title: "조부모 선물 준비" },
        ],
        title: "형제자매·조부모 의상 준비",
      },
      {
        description:
          "혼주 헤어와 메이크업을 예약하고, 인원과 출장 여부까지 정해요.",
        id: "step-33",
        order: 6,
        tasks: [
          { id: "catalog-item-134", title: "출장 메이크업 여부 결정" },
          { id: "catalog-item-135", title: "혼주 메이크업 인원 확정" },
          { id: "catalog-item-136", title: "혼주 메이크업 예약" },
          { id: "catalog-item-137", title: "혼주 헤어 예약" },
        ],
        title: "혼주 헤어·메이크업 예약",
      },
      {
        description: "빌렸던 가족 물품을 돌려줘요.",
        id: "step-34",
        order: 7,
        tasks: [{ id: "catalog-item-138", title: "가족 대여 물품 반납" }],
        title: "가족 대여 물품 반납",
      },
    ],
    title: "가족 준비 로드맵",
  },
  {
    category: { id: "other", label: "기타" },
    steps: [
      {
        description:
          "전체 예산과 예비비를 정하고, 예식 시기와 지역 같은 기본 조건을 세워요.",
        id: "step-35",
        order: 1,
        tasks: [
          { id: "catalog-item-139", title: "총예산 수립" },
          { id: "catalog-item-140", title: "예비비 편성" },
          { id: "catalog-item-141", title: "예식 희망 날짜 범위 결정" },
          { id: "catalog-item-142", title: "예식 지역 결정" },
          { id: "catalog-item-143", title: "현금영수증·소득공제 방식 확인" },
        ],
        title: "총예산 수립과 예식 기본 조건 결정",
      },
      {
        description:
          "웨딩밴드 매장을 둘러보고, 마음에 드는 반지를 골라 계약해요.",
        id: "step-36",
        order: 2,
        tasks: [
          { id: "catalog-item-144", title: "웨딩밴드 투어" },
          { id: "catalog-item-145", title: "결혼반지 선택" },
          { id: "catalog-item-146", title: "웨딩밴드 계약" },
        ],
        title: "결혼반지 투어와 계약",
      },
      {
        description:
          "촬영과 본식 전에 받을 피부, 치아, 헤어 관리 일정을 미리 잡아요.",
        id: "step-37",
        order: 3,
        tasks: [
          { id: "catalog-item-147", title: "결혼 전 건강검진 여부 결정" },
          { id: "catalog-item-148", title: "치아 관리 일정 예약" },
          { id: "catalog-item-149", title: "피부 관리 일정 예약" },
          { id: "catalog-item-150", title: "헤어·염색 일정 예약" },
          { id: "catalog-item-151", title: "네일 일정 예약" },
        ],
        title: "웨딩 전 피부·치아·헤어 관리 예약",
      },
      {
        description: "신혼여행지를 정하고, 항공권과 숙소를 예약해요.",
        id: "step-38",
        order: 4,
        tasks: [
          { id: "catalog-item-152", title: "신혼여행지 결정" },
          { id: "catalog-item-153", title: "항공권 예약" },
          { id: "catalog-item-154", title: "숙소 예약" },
        ],
        title: "신혼여행지 결정과 항공·숙소 예약",
      },
      {
        description:
          "여권과 비자를 챙기고, 환전과 해외 결제 수단, 로밍까지 준비해요.",
        id: "step-39",
        order: 5,
        tasks: [
          { id: "catalog-item-155", title: "여권 유효기간 확인" },
          { id: "catalog-item-156", title: "비자·입국 등록 확인" },
          { id: "catalog-item-157", title: "여행자보험 가입" },
          { id: "catalog-item-158", title: "해외결제 카드·트래블페이 준비" },
          { id: "catalog-item-159", title: "환전·외화 준비" },
          { id: "catalog-item-160", title: "로밍·eSIM 준비" },
        ],
        title: "출국 준비와 해외 결제 수단 마련",
      },
      {
        description: "신혼집을 구해 계약하고, 어디까지 고칠지 범위를 정해요.",
        id: "step-40",
        order: 6,
        tasks: [
          { id: "catalog-item-161", title: "신혼집 후보 조사" },
          { id: "catalog-item-162", title: "신혼집 계약" },
          { id: "catalog-item-163", title: "인테리어·공사 범위 결정" },
        ],
        title: "신혼집 계약과 인테리어 범위 결정",
      },
      {
        description:
          "혼수 목록을 정해 가전과 가구를 계약하고, 이사 업체도 예약해요.",
        id: "step-41",
        order: 7,
        tasks: [
          { id: "catalog-item-164", title: "혼수 목록 결정" },
          { id: "catalog-item-165", title: "가전·가구 계약" },
          { id: "catalog-item-166", title: "이사 업체 예약" },
        ],
        title: "혼수 구입과 이사 준비",
      },
      {
        description: "새 집에 들어가 전입신고와 확정일자까지 마쳐요.",
        id: "step-42",
        order: 8,
        tasks: [
          { id: "catalog-item-167", title: "신혼집 입주" },
          { id: "catalog-item-168", title: "전입신고·확정일자 처리" },
        ],
        title: "신혼집 입주와 전입신고",
      },
      {
        description: "구청에 혼인신고를 접수해요.",
        id: "step-43",
        order: 9,
        tasks: [{ id: "catalog-item-169", title: "혼인신고 접수" }],
        title: "혼인신고 접수",
      },
    ],
    title: "기타 준비 로드맵",
  },
] satisfies PreparationCategoryRoadmapData[];

export const preparationRoadmapData = {
  categories: categoryRoadmaps.map(({ category }) => category),
  roadmaps: categoryRoadmaps.map(({ category, steps, title }) => ({
    categoryId: category.id,
    steps: steps.map(({ description, id, order, title: stepTitle }) => ({
      description,
      id,
      order,
      title: stepTitle,
    })),
    title,
  })),
  stepDetails: categoryRoadmaps.flatMap(({ steps }) =>
    steps.map(({ description, id, tasks }) => ({
      description,
      stepId: id,
      tasks,
    })),
  ),
} satisfies PreparationCatalogModel;
