export interface BalanceGameOption {
  id: string;
  text: string;
  imagePath: string | null;
}

export interface BalanceGameQuestion {
  id: string;
  order: number;
  question: string;
  options: BalanceGameOption[];
}

export interface BalanceGameAnswer {
  questionId: string;
  optionId: BalanceGameOption["id"];
}

export interface BalanceGameRecommendation {
  catalogItemId: number;
  title: string;
  categoryName: string;
  stepName: string;
}

export interface BalanceGameResult {
  id: string;
  name: string;
  summary: string;
  imageUrl: string;
  catalogItemIds: number[];
}
