import type {
  BalanceGameQuestion,
  BalanceGameRecommendation,
  BalanceGameResult,
} from "../model/balanceGame";

export const questions: BalanceGameQuestion[] = [
  {
    id: "Q1",
    order: 1,
    question: "결혼식 날, 어떤 사진을 남기고 싶어?",
    options: [
      {
        id: "A",
        text: "아이폰 사진도 남길래",
        imagePath: "/balance-game/q01-a.webp",
      },
      {
        id: "B",
        text: "본식 사진이면 충분해",
        imagePath: "/balance-game/q01-b.webp",
      },
      { id: "UNKNOWN", text: "아직 잘 모르겠어", imagePath: null },
    ],
  },
  {
    id: "Q10",
    order: 10,
    question: "함께 살 집은 어떻게 시작할까?",
    options: [
      {
        id: "A",
        text: "새 집을 구할래",
        imagePath: "/balance-game/q10-a.webp",
      },
      { id: "B", text: "살던 집에서 시작할래", imagePath: null },
      { id: "UNKNOWN", text: "아직 잘 모르겠어", imagePath: null },
    ],
  },
];

export const items: BalanceGameRecommendation[] = [
  {
    catalogItemId: 19,
    title: "본식스냅 계약",
    categoryName: "예식",
    stepName: "본식 촬영",
  },
  {
    catalogItemId: 22,
    title: "아이폰스냅 계약",
    categoryName: "예식",
    stepName: "본식 촬영",
  },
  {
    catalogItemId: 161,
    title: "신혼집 후보 조사",
    categoryName: "신혼생활",
    stepName: "신혼집",
  },
];

export const result: BalanceGameResult = {
  id: "LUXURY",
  name: "한 번뿐인 날 화려파",
  summary: "우리에게 맞는 결혼 준비를 골라보세요.",
  imageUrl: "https://example.com/luxury.webp",
  catalogItemIds: [19, 22, 161],
};
export const wireQuestions = {
  questions: questions.map((q) => ({
    id: q.id,
    text: q.question,
    options: q.options
      .filter((o) => o.id !== "UNKNOWN")
      .map((o) => ({ id: o.id, text: o.text, imageUrl: o.imagePath ?? "" })),
  })),
};
export const catalog = {
  categories: [
    { id: "1", label: "예식" },
    { id: "2", label: "신혼생활" },
  ],
  roadmaps: [
    { categoryId: "1", steps: [{ id: "1", title: "본식 촬영", order: 1 }] },
    { categoryId: "2", steps: [{ id: "2", title: "신혼집", order: 1 }] },
  ],
  stepDetails: [
    {
      stepId: "1",
      description: "",
      tasks: items
        .slice(0, 2)
        .map((i) => ({ id: String(i.catalogItemId), title: i.title })),
    },
    {
      stepId: "2",
      description: "",
      tasks: items
        .slice(2)
        .map((i) => ({ id: String(i.catalogItemId), title: i.title })),
    },
  ],
};
