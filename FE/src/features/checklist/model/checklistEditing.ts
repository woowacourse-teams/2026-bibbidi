export type ChecklistItemChangeKind = "category" | "title";

export type ChecklistItemChangeFeedback =
  | { status: "idle" }
  | { itemId: number; kind: ChecklistItemChangeKind; status: "pending" }
  | {
      errorMessage: string;
      itemId: number;
      kind: ChecklistItemChangeKind;
      status: "error";
    };

export interface ChecklistItemTitleEditSession {
  draft: string;
  itemId: number;
}

export interface ChecklistItemCategoryEditSession {
  itemId: number;
}

export interface ChecklistItemEditingController {
  categoryEditSession: ChecklistItemCategoryEditSession | null;
  changeCategory(itemId: number, categoryId: string): Promise<boolean>;
  changeFeedback: ChecklistItemChangeFeedback;
  changeTitle(itemId: number, title: string): Promise<boolean>;
  clearError(itemId: number): void;
  finishCategoryEditing(itemId: number): void;
  finishTitleEditing(itemId: number): void;
  startCategoryEditing(itemId: number): void;
  startTitleEditing(itemId: number, title: string): void;
  titleEditSession: ChecklistItemTitleEditSession | null;
  updateTitleDraft(itemId: number, draft: string): void;
}
