import {
  PreparationCatalogModel,
  PreparationDetailTaskModel,
  PreparationStepModel,
} from "./preparationRoadmap";

interface PreparationStepData extends PreparationStepModel {
  tasks: PreparationDetailTaskModel[];
}

function createStepModel(step: PreparationStepData): PreparationStepModel {
  return {
    description: step.description,
    id: step.id,
    order: step.order,
    title: step.title,
  };
}

const weddingHallSteps = [
  {
    description:
      "마음에 드는 웨딩홀을 직접 둘러보고, 조건을 꼼꼼히 비교해서 한 곳과 계약해요.",
    id: "venue-tour-contract",
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
    id: "ceremony-format-plan",
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
    id: "ceremony-staff",
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
    id: "ceremony-script-media",
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
    description: "소중한 순간을 사진과 영상으로 남겨줄 업체를 찾아 계약해요.",
    id: "wedding-recording-contract",
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
    id: "ceremony-gifts-items",
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
    id: "rehearsal-wedding-day-prep",
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
    id: "wedding-day",
    order: 8,
    tasks: [{ id: "catalog-item-34", title: "본식 진행" }],
    title: "본식 당일 진행",
  },
  {
    description: "예식 비용을 정산하고, 도와준 분들께 감사한 마음을 전해요.",
    id: "ceremony-settlement",
    order: 9,
    tasks: [
      { id: "catalog-item-35", title: "예식비용 정산" },
      { id: "catalog-item-36", title: "사례비 전달" },
    ],
    title: "예식 비용 정산과 사례비 전달",
  },
] satisfies PreparationStepData[];

export const preparationRoadmapData = {
  categories: [
    { id: "wedding-hall", label: "웨딩홀" },
    { id: "studio-dress-makeup", label: "스드메" },
    { id: "family", label: "가족" },
    { id: "invitation", label: "초대" },
    { id: "other", label: "기타" },
  ],
  roadmap: {
    categoryId: "wedding-hall",
    steps: weddingHallSteps.map(createStepModel),
    title: "웨딩홀 준비 로드맵",
  },
  stepDetails: weddingHallSteps.map(({ description, id, tasks }) => ({
    description,
    stepId: id,
    tasks,
  })),
} satisfies PreparationCatalogModel;
