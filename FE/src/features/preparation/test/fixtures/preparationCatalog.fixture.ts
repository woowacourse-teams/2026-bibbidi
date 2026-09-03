import { PreparationCatalogModel } from "../../model/preparationRoadmap";

export const preparationCatalogFixture = {
  categories: [
    { id: "wedding-hall", label: "웨딩홀" },
    { id: "studio-dress-makeup", label: "스드메" },
  ],
  roadmaps: [
    {
      categoryId: "wedding-hall",
      steps: [
        {
          id: "step-1",
          iconUrl: "https://example.com/wedding-hall.png",
          order: 1,
          title: "웨딩홀 투어와 계약",
        },
        {
          id: "step-2",
          order: 2,
          title: "예식 형태·식순·입장 방식 결정",
        },
        {
          id: "step-3",
          order: 3,
          title: "예식 진행자와 당일 도우미 섭외",
        },
      ],
    },
    {
      categoryId: "studio-dress-makeup",
      steps: [
        {
          id: "step-10",
          order: 1,
          title: "스드메 상담·견적과 패키지 계약",
        },
      ],
    },
  ],
  stepDetails: [
    {
      description: "웨딩홀을 둘러보고 계약해요.",
      stepId: "step-1",
      tasks: [{ id: "catalog-item-1", title: "웨딩홀 투어" }],
    },
    {
      description: "예식 형태와 식순을 정해요.",
      stepId: "step-2",
      tasks: [{ id: "catalog-item-2", title: "예식 형태 결정" }],
    },
    {
      description: "예식 진행자를 섭외해요.",
      stepId: "step-3",
      tasks: [{ id: "catalog-item-3", title: "사회자 섭외" }],
    },
    {
      description: "스드메 상품을 비교하고 계약해요.",
      stepId: "step-10",
      tasks: [{ id: "catalog-item-10", title: "스드메 계약" }],
    },
  ],
} satisfies PreparationCatalogModel;
