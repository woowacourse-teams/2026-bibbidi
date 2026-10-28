export interface BalanceGameOption {
  id: "A" | "B" | "UNKNOWN";
  text: string;
  imagePath: string | null;
}

export interface BalanceGameQuestion {
  id: number;
  order: number;
  question: string;
  options: BalanceGameOption[];
}

export interface BalanceGameAnswer {
  questionId: number;
  optionId: BalanceGameOption["id"];
}

export interface BalanceGameRecommendation {
  catalogItemId: number;
  title: string;
  categoryName: string;
  phase: number;
  stepName: string;
}
