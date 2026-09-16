export type ChecklistItemChangeFeedback =
  | { status: "idle" }
  | { itemId: number; status: "pending" }
  | { errorMessage: string; itemId: number; status: "error" };

export interface ChecklistItemTitleEditSession {
  draft: string;
  itemId: number;
}

export interface ChecklistItemEditingController {
  changeTitle(itemId: number, title: string): Promise<boolean>;
  clearError(itemId: number): void;
  finishTitleEditing(itemId: number): void;
  startTitleEditing(itemId: number, title: string): void;
  titleEditSession: ChecklistItemTitleEditSession | null;
  titleFeedback: ChecklistItemChangeFeedback;
  updateTitleDraft(itemId: number, draft: string): void;
}
