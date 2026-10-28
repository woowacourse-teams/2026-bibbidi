import type {
  BalanceGameQuestion,
  BalanceGameRecommendation,
} from "../model/balanceGame";

export const questions: BalanceGameQuestion[] = [
  {
    id: 1,
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
    id: 10,
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
    phase: 1,
    stepName: "본식 촬영",
  },
  {
    catalogItemId: 22,
    title: "아이폰스냅 계약",
    categoryName: "예식",
    phase: 1,
    stepName: "본식 촬영",
  },
  {
    catalogItemId: 161,
    title: "신혼집 후보 조사",
    categoryName: "신혼생활",
    phase: 2,
    stepName: "신혼집",
  },
];
