export interface RecommendedTask {
  id: string;
  title: string;
  stepTitle: string;
}

export interface AnswerRecommendations {
  tasks: RecommendedTask[];
  selectedIds: string[];
  saving: boolean;
  dismissed: boolean;
  error?: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDismiss: () => void;
  onRestore: () => void;
}

export interface RecommendationController {
  catalogStatus: "loading" | "error" | "ready";
  forAnswer: (answerId: number, ids: string[]) => AnswerRecommendations;
  retryCatalog: () => void;
}
