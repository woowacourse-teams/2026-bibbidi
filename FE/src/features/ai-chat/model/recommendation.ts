export interface RecommendedTask {
  id: string;
  title: string;
  stepTitle: string;
  order: number;
}

export interface AnswerRecommendations {
  tasks: RecommendedTask[];
  selectedId?: string;
  saving: boolean;
  error?: string;
  onSelect: (id: string) => void;
  onSkip: (id: string) => void;
  onAdd: (id: string) => void;
}

export interface RecommendationController {
  catalogStatus: "loading" | "error" | "ready";
  forAnswer: (answerId: number, ids: string[]) => AnswerRecommendations;
  retryCatalog: () => void;
}
