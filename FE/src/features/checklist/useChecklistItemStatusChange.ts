import { useCallback, useEffect, useRef, useState } from "react";
import { analytics } from "../../infrastructure/analytics";
import { createChecklistTaskCompleteEvent } from "./analytics/checklistAnalytics";
import {
  ChecklistItemStatusConfirmation,
  ChecklistItemStatusChangeResult,
} from "./model/checklistEditing";
import { ChecklistAudience } from "./model/checklistQuery";
import { ChecklistItemStatus } from "./model/myChecklist";
import {
  ChecklistItemChangeError,
  MyChecklistCommandRepository,
} from "./repository/myChecklistCommandRepository";
import { useChecklistItemChangeRequest } from "./useChecklistItemChangeRequest";

function trackCompletion(
  itemId: number,
  status: ChecklistItemStatus,
  categoryId?: string | null,
  fromStatus?: ChecklistItemStatus,
) {
  analytics.track({
    name: "checklist_task_status_change",
    parameters: {
      checklist_item_id: itemId,
      to_status: status,
      ...(fromStatus ? { from_status: fromStatus } : {}),
      source: "checklist",
    },
  });
  if (status === "done" && categoryId)
    analytics.track(createChecklistTaskCompleteEvent(categoryId, itemId));
}

export function useChecklistItemStatusChange(
  repository: MyChecklistCommandRepository,
  requests: ReturnType<typeof useChecklistItemChangeRequest>,
  {
    audience,
    activeItemId,
    getCategoryId,
    getStatus,
  }: {
    audience: ChecklistAudience | undefined;
    activeItemId?: number | null;
    getCategoryId?: (itemId: number) => string | null | undefined;
    getStatus?: (itemId: number) => ChecklistItemStatus | undefined;
  },
) {
  const { runRequest, cancelOtherRequest, resetFeedback, clearError } =
    requests;
  const [statusConfirmation, setStatusConfirmation] =
    useState<ChecklistItemStatusConfirmation | null>(null);
  const confirmationCategoryRef = useRef<string | null | undefined>(undefined);

  const confirmationFromStatusRef = useRef<ChecklistItemStatus | undefined>(
    undefined,
  );

  useEffect(() => {
    if (audience !== "guest" && activeItemId === undefined) return;
    if (activeItemId !== undefined) cancelOtherRequest("status", activeItemId);
    let isActive = true;
    queueMicrotask(() => {
      if (!isActive) return;
      setStatusConfirmation((current) =>
        audience === "guest" || current?.itemId !== activeItemId
          ? null
          : current,
      );
      resetFeedback("status", audience === "guest" ? undefined : activeItemId);
    });
    return () => {
      isActive = false;
    };
  }, [activeItemId, audience, cancelOtherRequest, resetFeedback]);

  return {
    statusConfirmation,
    cancelStatusChange: useCallback(
      (itemId: number) => {
        setStatusConfirmation((current) =>
          current?.itemId === itemId ? null : current,
        );
        clearError(itemId);
      },
      [clearError],
    ),
    requestStatusChange: useCallback(
      async (
        itemId: number,
        status: ChecklistItemStatus,
      ): Promise<ChecklistItemStatusChangeResult> => {
        const categoryId = getCategoryId?.(itemId);
        const fromStatus = getStatus?.(itemId);
        if (status === "done") {
          const remaining = await runRequest(itemId, "status", (signal) =>
            repository.hasRemainingAppointments(itemId, signal),
          );
          if (!remaining.ok) return "failed";
          if (remaining.value) {
            confirmationCategoryRef.current = categoryId;
            confirmationFromStatusRef.current = fromStatus;
            setStatusConfirmation({ itemId, status: "done" });
            return "confirmation-required";
          }
        }
        const result = await runRequest(itemId, "status", (signal) =>
          repository.changeItemStatus(itemId, status, signal),
        );
        if (result.ok) trackCompletion(itemId, status, categoryId, fromStatus);
        return result.ok ? "changed" : "failed";
      },
      [getCategoryId, getStatus, repository, runRequest],
    ),
    confirmStatusChange: useCallback(
      async (itemId: number) => {
        if (statusConfirmation?.itemId !== itemId) return false;
        const categoryId = confirmationCategoryRef.current;
        const result = await runRequest(itemId, "status", (signal) =>
          repository.changeItemStatus(
            itemId,
            statusConfirmation.status,
            signal,
          ),
        );
        if (
          result.ok ||
          (result.error instanceof ChecklistItemChangeError &&
            result.error.reason === "refresh-failed")
        )
          setStatusConfirmation(null);
        if (result.ok)
          trackCompletion(
            itemId,
            "done",
            categoryId,
            confirmationFromStatusRef.current,
          );
        return result.ok;
      },
      [repository, runRequest, statusConfirmation],
    ),
  };
}
