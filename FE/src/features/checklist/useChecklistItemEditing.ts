import { useCallback, useEffect, useState } from "react";

import { analytics } from "../../infrastructure/analytics";
import {
  createChecklistTaskCategoryUpdateEvent,
  createChecklistTaskTitleUpdateEvent,
} from "./analytics/checklistAnalytics";
import {
  ChecklistItemCategoryEditSession,
  ChecklistItemEditingController,
  ChecklistItemStatusEditSession,
  ChecklistItemTitleEditSession,
} from "./model/checklistEditing";
import { ChecklistAudience } from "./model/checklistQuery";
import { MyChecklistCommandRepository } from "./repository/myChecklistCommandRepository";

import { useChecklistItemChangeRequest } from "./useChecklistItemChangeRequest";
import { useChecklistItemStatusChange } from "./useChecklistItemStatusChange";

export function useChecklistItemEditing(
  commandRepository: MyChecklistCommandRepository,
  refreshAuth: () => void,
  audience: ChecklistAudience | undefined,
  activeItemId?: number | null,
  onRefreshFailed?: (message: string) => void,
  activeCategoryId?: string | null,
): ChecklistItemEditingController {
  const [deletionConfirmation, setDeletionConfirmation] = useState<
    number | null
  >(null);
  const [categoryEditSession, setCategoryEditSession] =
    useState<ChecklistItemCategoryEditSession | null>(null);
  const [titleEditSession, setTitleEditSession] =
    useState<ChecklistItemTitleEditSession | null>(null);
  const [statusEditSession, setStatusEditSession] =
    useState<ChecklistItemStatusEditSession | null>(null);
  const requests = useChecklistItemChangeRequest(
    refreshAuth,
    audience,
    onRefreshFailed,
  );
  const { changeFeedback, runRequest, resetFeedback, clearError } = requests;
  const getCategoryId = useCallback(() => activeCategoryId, [activeCategoryId]);
  const statusChange = useChecklistItemStatusChange(
    commandRepository,
    requests,
    { audience, activeItemId, getCategoryId },
  );

  useEffect(() => {
    if (audience !== "guest") {
      return;
    }

    let isActive = true;

    queueMicrotask(() => {
      if (isActive) {
        setCategoryEditSession(null);
        setStatusEditSession(null);
        setTitleEditSession(null);
        setDeletionConfirmation(null);
      }
    });

    return () => {
      isActive = false;
    };
  }, [audience]);

  useEffect(() => {
    if (activeItemId === undefined) {
      return;
    }

    let isActive = true;

    queueMicrotask(() => {
      if (!isActive) {
        return;
      }

      setStatusEditSession((current) =>
        current && current.itemId !== activeItemId ? null : current,
      );
    });

    return () => {
      isActive = false;
    };
  }, [activeItemId]);

  return {
    ...statusChange,
    categoryEditSession,
    changeCategory: useCallback(
      async (itemId: number, categoryId: string) => {
        const result = await runRequest(itemId, "category", (signal) =>
          commandRepository.changeItemCategory(
            itemId,
            Number(categoryId),
            signal,
          ),
        );

        if (result.ok) {
          analytics.track(createChecklistTaskCategoryUpdateEvent(categoryId));
        }

        return result.ok;
      },
      [commandRepository, runRequest],
    ),
    changeFeedback,
    cancelDelete: () => {
      if (changeFeedback.status !== "pending") {
        setDeletionConfirmation(null);
        resetFeedback();
      }
    },
    confirmDelete: useCallback(async () => {
      if (deletionConfirmation === null) {
        return false;
      }

      const result = await runRequest(
        deletionConfirmation,
        "delete",
        (signal) =>
          commandRepository.deleteItem
            ? commandRepository.deleteItem(deletionConfirmation, signal)
            : Promise.reject(
                new Error("Checklist item deletion is unavailable"),
              ),
      );

      if (result.ok) {
        setDeletionConfirmation(null);
      }

      return result.ok;
    }, [commandRepository, deletionConfirmation, runRequest]),
    changeTitle: useCallback(
      async (itemId: number, title: string) => {
        const result = await runRequest(itemId, "title", (signal) =>
          commandRepository.changeItemTitle(itemId, title, signal),
        );

        if (result.ok) {
          analytics.track(createChecklistTaskTitleUpdateEvent());
        }

        return result.ok;
      },
      [commandRepository, runRequest],
    ),
    deletionConfirmation,
    clearError,
    finishCategoryEditing: useCallback((itemId: number) => {
      setCategoryEditSession((current) =>
        current?.itemId === itemId ? null : current,
      );
    }, []),
    finishStatusEditing: useCallback((itemId: number) => {
      setStatusEditSession((current) =>
        current?.itemId === itemId ? null : current,
      );
    }, []),
    finishTitleEditing: useCallback((itemId: number) => {
      setTitleEditSession((current) =>
        current?.itemId === itemId ? null : current,
      );
    }, []),
    requestDelete: useCallback(
      (itemId: number) => {
        if (changeFeedback.status !== "pending") {
          setDeletionConfirmation(itemId);
          resetFeedback();
        }
      },
      [changeFeedback.status, resetFeedback],
    ),
    startCategoryEditing: useCallback((itemId: number) => {
      setTitleEditSession(null);
      setStatusEditSession(null);
      setCategoryEditSession({ itemId });
    }, []),
    startStatusEditing: useCallback((itemId: number) => {
      setCategoryEditSession(null);
      setTitleEditSession(null);
      setStatusEditSession({ itemId });
    }, []),
    startTitleEditing: useCallback((itemId: number, title: string) => {
      setCategoryEditSession(null);
      setStatusEditSession(null);
      setTitleEditSession({ draft: title, itemId });
    }, []),
    statusEditSession,
    titleEditSession,
    updateTitleDraft: useCallback((itemId: number, draft: string) => {
      setTitleEditSession((current) =>
        current?.itemId === itemId ? { draft, itemId } : current,
      );
    }, []),
  };
}
