import { ChecklistItemStatus } from "./myChecklist";

export type ChecklistItemChangeKind = "category" | "status" | "title";

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

export interface ChecklistItemStatusEditSession {
  itemId: number;
}

export interface ChecklistItemStatusConfirmation {
  itemId: number;
  status: "done";
}

export type ChecklistItemStatusChangeResult =
  "changed" | "confirmation-required" | "failed";

export interface ChecklistItemEditingController {
  categoryEditSession: ChecklistItemCategoryEditSession | null;
  cancelStatusChange(itemId: number): void;
  changeCategory(itemId: number, categoryId: string): Promise<boolean>;
  changeFeedback: ChecklistItemChangeFeedback;
  confirmStatusChange(itemId: number): Promise<boolean>;
  requestStatusChange(
    itemId: number,
    status: ChecklistItemStatus,
  ): Promise<ChecklistItemStatusChangeResult>;
  changeTitle(itemId: number, title: string): Promise<boolean>;
  clearError(itemId: number): void;
  finishCategoryEditing(itemId: number): void;
  finishStatusEditing(itemId: number): void;
  finishTitleEditing(itemId: number): void;
  startCategoryEditing(itemId: number): void;
  startStatusEditing(itemId: number): void;
  startTitleEditing(itemId: number, title: string): void;
  titleEditSession: ChecklistItemTitleEditSession | null;
  statusConfirmation: ChecklistItemStatusConfirmation | null;
  statusEditSession: ChecklistItemStatusEditSession | null;
  updateTitleDraft(itemId: number, draft: string): void;
}
