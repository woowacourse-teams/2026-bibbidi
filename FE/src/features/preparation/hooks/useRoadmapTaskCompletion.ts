import { useCallback, useMemo } from "react";
import { useAuth } from "../../auth";
import { useChecklistCommandRepository } from "../../checklist/checklistQueryDependencies";
import {
  ChecklistQueryModel,
  getChecklistCategoryItems,
} from "../../checklist/model/checklistQuery";
import { useChecklistItemChangeRequest } from "../../checklist/useChecklistItemChangeRequest";
import { useChecklistItemStatusChange } from "../../checklist/useChecklistItemStatusChange";

export function useRoadmapTaskCompletion(
  checklist: ChecklistQueryModel | null,
  onRefreshFailed: (message: string) => void,
) {
  const { authState, refreshAuth } = useAuth();
  const audience =
    authState.status === "authenticated" ? "authenticated" : undefined;
  const repository = useChecklistCommandRepository();
  const requests = useChecklistItemChangeRequest(
    refreshAuth,
    audience,
    onRefreshFailed,
  );
  const tasks = useMemo(
    () => checklist?.categories.flatMap(getChecklistCategoryItems) ?? [],
    [checklist],
  );
  const getCategoryId = useCallback(
    (itemId: number) =>
      tasks.find((task) => task.checklistItemId === itemId)?.categoryId,
    [tasks],
  );
  const statusChange = useChecklistItemStatusChange(repository, requests, {
    audience,
    getCategoryId,
  });
  const { changeFeedback, clearError } = requests;
  return {
    ...statusChange,
    isPending: changeFeedback.status === "pending",
    errorMessage:
      changeFeedback.status === "error"
        ? changeFeedback.errorMessage
        : undefined,
    completeTask: async (taskId: string, checked: boolean) => {
      const task = tasks.find((task) => task.id === taskId);
      if (!task?.checklistItemId) return;
      await statusChange.requestStatusChange(
        task.checklistItemId,
        checked ? "done" : "continue",
      );
    },
    clearError: () => {
      if (changeFeedback.status === "error") clearError(changeFeedback.itemId);
    },
  };
}
