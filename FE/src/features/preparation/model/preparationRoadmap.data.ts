import { PreparationCatalogModel } from "./preparationRoadmap";

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
    defaultStepId: "photo-video-contract",
    steps: [
      {
        description: "후보를 찾고 둘러보며 조건을 비교해요.",
        id: "venue-search",
        order: 1,
        status: "complete",
        title: "예식장 탐색",
      },
      {
        description: "조건을 확인하고 웨딩홀을 계약해요.",
        id: "venue-contract",
        order: 2,
        status: "complete",
        title: "예식장 계약",
      },
      {
        description: "예식 형태와 입장 방식, 식순을 정해요.",
        id: "ceremony-plan",
        order: 3,
        status: "complete",
        title: "예식 구성 결정",
      },
      {
        description: "주례와 사회자, 축가 담당자를 정해요.",
        id: "ceremony-staff",
        order: 4,
        status: "complete",
        title: "진행 인력 섭외",
      },
      {
        description: "본식 사진과 영상 업체를 비교해요.",
        id: "photo-video-contract",
        order: 5,
        status: "in-progress",
        title: "촬영 업체 계약",
      },
      {
        description: "대본과 선언문, 본식 음원을 준비해요.",
        id: "documents-and-music",
        order: 6,
        status: "upcoming",
        title: "문서·음원 준비",
      },
      {
        description: "부케와 식권, 포토테이블을 준비해요.",
        id: "ceremony-items",
        order: 7,
        status: "upcoming",
        title: "예식 물품 준비",
      },
      {
        description: "시식과 리허설로 마지막 점검을 해요.",
        id: "final-check",
        order: 8,
        status: "upcoming",
        title: "사전 점검",
      },
      {
        description: "본식을 진행하고 비용을 정산해요.",
        id: "wedding-day",
        order: 9,
        status: "upcoming",
        title: "본식 당일·사후 정리",
      },
    ],
    title: "웨딩홀 준비 로드맵",
  },
  stepDetails: [
    {
      description: "본식 사진과 영상 업체를 비교하고 계약해요.",
      stepId: "photo-video-contract",
      tasks: [
        {
          id: "wedding-snapshot-contract",
          title: "본식 스냅 계약",
        },
        {
          id: "wedding-video-vendor-comparison",
          title: "본식 영상 업체 비교",
        },
        {
          id: "wedding-video-contract",
          title: "본식 영상 계약",
        },
      ],
    },
  ],
} satisfies PreparationCatalogModel;
